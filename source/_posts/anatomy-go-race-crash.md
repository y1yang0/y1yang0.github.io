---
layout: post
title:  "Anatomy of Go Race Crash with Auto-instrumentation"
date:   2024-12-30
categories: [Golang]
---

Recently, we released and open-sourced our [compile-time auto-instrumentation tool for Go](https://github.com/alibaba/opentelemetry-go-auto-instrumentation)

![](../images/otel-race-crash.png)

A user reported that replacing the standard `go build -race` command with our tool's equivalent caused the resulting program to crash. The [`-race` flag](https://go.dev/doc/articles/race_detector) is a Go compiler option used to detect data races. It works by adding extra checks to every memory access, ensuring that multiple goroutines do not access shared variables unsafely at the same time.

In theory, our tool should not interfere with the race detection code, so this crash was unexpected. I spent some time investigating the issue. The crash stack trace was as follows:
```

(gdb) bt
#0  0x000000000041e1c0 in __tsan_func_enter ()
#1  0x00000000004ad05a in racecall ()
#2  0x0000000000000001 in ?? ()
#3  0x00000000004acf99 in racefuncenter ()
#4  0x00000000004ae7f1 in runtime.racefuncenter (callpc=4317632)
#5  0x0000000000a247d8 in ../sdk/trace.(*traceContext).TakeSnapShot (tc=<optimized out>, ~r0=...)
#6  0x00000000004a2c25 in runtime.contextPropagate
#7  0x0000000000480185 in runtime.newproc1.func1 () 
#8  0x00000000004800e2 in runtime.newproc1 (fn=0xc00030a1f0, callergp=0xc0000061e0, callerpc=12379404, retVal0=0xc0002c8f00)
#9  0x000000000047fc3f in runtime.newproc.func1 () 
#10 0x00000000004a992a in runtime.systemstack ()
....
```
As you can see, the crash originates in `__tsan_func_enter`, and the key trigger is the `runtime.contextPropagate` call. Our tool injects the following code at the beginning of the `runtime.newproc1` function:
```go
func newproc1(fn *funcval, callergp *g, callerpc uintptr) (retVal0 *g) {
    // Our injected code
    retVal0.otel_trace_context = contextPropagate(callergp.otel_trace_context)

    // ... original function body
}

// Our injected code
func contextPropagate(tls interface{}) interface{} {
  if tls == nil {
    return nil
  }
  if taker, ok := tls.(ContextSnapshoter); ok {
    return taker.TakeSnapShot()
  }
  return tls
}

// Our injected code
func (tc *traceContext) TakeSnapShot() interface{} {
  // ...
}
```

The Go compiler, when the `-race` flag is active, injects `racefuncenter()` and `racefuncexit()` calls at the entry and exit points of `TakeSnapShot`, respectively. This eventually leads to the call to `__tsan_func_enter` that causes the crash. This confirmed that the crash was indeed caused by our injected code, prompting a deeper investigation.

## The Investigation

### Root Cause of the Crash
Using **objdump** to inspect the source code of `__tsan_func_enter`, I saw that it takes two function arguments. The faulting instruction is the first line, `mov 0x10(%rdi),%rdx`, which is roughly equivalent to `rdx = *(rdi + 0x10)`. After printing the registers, we found that `rdi = 0`. According to the calling convention, `rdi` holds the first function argument. Therefore, the problem was that the first argument, `thr`, was 0.
```
// void __tsan_func_enter(ThreadState *thr, void *pc);
000000000041e1c0 <__tsan_func_enter>:
  41e1c0:  48 8b 57 10            mov    0x10(%rdi),%rdx
  41e1c4:  48 8d 42 08            lea    0x8(%rdx),%rax
  41e1c8:  a9 f0 0f 00 00         test   $0xff0,%eax
  ...
```
So, where did this zero-valued `thr` argument come from? I proceeded to analyze the call chain.

### Call Chain Analysis
The full call chain leading to the crash is **racefuncenter (Go) -> racecall (Go) -> __tsan_func_enter (C)**. It's important to note that the first two functions are in Go and follow the Go calling convention. The amd64 architecture uses the following sequence of 9 registers for integer arguments and results:

```
RAX, RBX, RCX, RDI, RSI, R8, R9, R10, R11
```

Special-purpose registers are as follows:

| Register	| Call meaning |
| :---------: | :---------: |
| RSP	| Stack pointer |
| RBP	| Frame pointer |
| RDX	| Closure context pointer |
| R12	| Scratch |
| R13	| Scratch |
| R14	| Current goroutine |
| R15	| GOT reference temporary if dynlink |
| X15	| Zero value |

The last two functions involve a Go-to-C call, which follows the System V AMD64 ABI. On Linux, the first six arguments are passed via registers

```
RDI, RSI, RDX, RCX, R8, R9
```

With an understanding of the Go and C calling conventions, let's examine the relevant code in the call chain:

```asm
TEXT  racefuncenter<>(SB), NOSPLIT|NOFRAME, $0-0
  MOVQ  DX, BXx
  MOVQ  g_racectx(R14), RARG0     // RSI holds thr
  MOVQ  R11, RARG1                 // RDI holds pc
  MOVQ  $__tsan_func_enter(SB), AX // AX holds __tsan_func_enter func pointer
  CALL  racecall<>(SB)
  MOVQ  BX, DX
  RET
TEXT  racecall<>(SB), NOSPLIT|NOFRAME, $0-0
  ...
  CALL  AX  // Call __tsan_func_enter func pointer
  ...
```

`racefuncenter` places `g_racectx(R14)` and `R11` into the C calling convention's argument registers, `RSI (RARG0)` and `RDI (RARG1)`, respectively. It then places the address of `__tsan_func_enter` into the Go argument register `RAX` and calls `racecall`, which in turn calls the function pointer in `RAX`. This sequence is roughly equivalent to `__tsan_func_enter(g_racectx(R14), R11)`.

It became clear that the root of the problem was that `g_racectx(R14)` was null. According to the Go calling convention, `R14` holds the current goroutine (`g`), which should never be null. Therefore, the `racectx` field of the `g` struct at `R14` must be null. I confirmed this using the **Delve debugger** to avoid any wasted effort:
```
(dlv) p *(*runtime.g)(R14)
runtime.g {
        racectx: 0,
        ...
}
```
So, why was the current `g.racectx` zero-valued? The next step was to examine the state of `R14`.

### Goroutine Scheduling

```go
func newproc(fn *funcval) {
  gp := getg()
  pc := sys.GetCallerPC() // #1
  systemstack(func() {
    newg := newproc1(fn, gp, pc) // #2
    ...
  })
}
```
Through my investigation, I found that at location #1, `R14.racectx` was valid. However, by the time execution reached location #2, it had become null. The reason was the call to `systemstack`, which performs a goroutine switch:
```go
// func systemstack(fn func())
TEXT runtime·systemstack(SB), NOSPLIT, $0-8
  ...
  // Switch to the g0 goroutine
  MOVQ  DX, g(CX)
  MOVQ  DX, R14 // Set the R14 register
  MOVQ  (g_sched+gobuf_sp)(DX), SP

  // Run the target function fn on the g0 goroutine
  MOVQ  DI, DX
  MOVQ  0(DI), DI
  CALL  DI

  // Switch back to the original goroutine
  ...
```

It turns out `systemstack` switches the current goroutine to `g0`, executes the provided function `fn`, and then switches back to the original goroutine.

In Go's G-M-P (Goroutine-Machine-Processor) scheduling model, each system-level thread (M) has a special g0 goroutine and several regular g goroutines for executing user tasks. The g0 goroutine is primarily responsible for scheduling the user goroutines on that M. Since goroutine scheduling is non-preemptive, this process temporarily switches to the system stack to execute code. Code running on the system stack is implicitly non-preemptible, and the garbage collector does not scan it.

At this point, I knew that `newproc1` always executes on the `g0` goroutine. I also discovered that `g0.racectx` is explicitly set to 0 at the start of the main function, which ultimately caused the crash:
```go
// src/runtime/proc.go#main
// The main goroutine.
func main() {
  mp := getg().m

  // The race context for g0 is used only as a parent for the main goroutine.
  // It must not be used for anything else.
  mp.g0.racectx = 0
  ...
}
```

## The Solution

I can now summarize the cause of the crash:

- The injected contextPropagate call in newproc1 leads to a call to TakeSnapshot.
- `go build -race` forces the insertion of a `racefuncenter()` call at the beginning of `TakeSnapshot`, which relies on `g.racectx`.
- `newproc1` runs on the `g0` goroutine, whose `racectx` field is always 0, leading to a null pointer dereference and a crash.

One solution is to add the special Go compiler directive `//go:norace` to the `TakeSnapshot` function. This directive, placed immediately after the function declaration, instructs the race detector to ignore memory accesses within that function, preventing the compiler from injecting the `racefuncenter()` call.

## Lingering Question 1
Our injected `contextPropagate` isn't the only function called within `runtime.newproc1`. Why aren't other functions in that file instrumented with race checks by the compiler?

After further digging, I found that the Go compiler gives special treatment to the `runtime` package. It sets a `NoInstrument` flag for code within this package, which skips the generation of race-checking code:
```go
// /src/cmd/internal/objabi/pkgspecial.go
var pkgSpecialsOnce = sync.OnceValue(func() map[string]PkgSpecial {
    ...
    for _, pkg := range runtimePkgs {
        set(pkg, func(ps *PkgSpecial) { 
            ps.Runtime = true
            ps.NoInstrument = true
        })
    }
    ...
})
```

## Lingering Question 2
In theory, adding `//go:norace` should have solved the problem, but the program still crashed. I discovered that `TakeSnapShot` contained map initialization and iteration logic. These operations are expanded by the compiler into runtime calls like `mapiterinit()`. These runtime helper functions manually enable race detection, and they cannot be disabled with `//go:norace`:
```go
func mapiterinit(t *abi.T, m *hmap, it *hiter) {
  if raceenabled && m != nil {
    // Active race check
    callerpc := getcallerpc()
    racereadpc(unsafe.Pointer(m), callerpc, funcPC(mapiterinit))
  }
    ...
}
```
The solution to this final problem was to refactor the code injected into newproc1 to avoid using map data structures.