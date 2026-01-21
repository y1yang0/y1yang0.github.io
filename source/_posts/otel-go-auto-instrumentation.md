---
layout: post
title:  "OpenTelemetry Golang Auto Instrumentation"
date:   2024-07-19
categories: [Golang]
---

Recently, we collaborated with other team at Alibaba Cloud to bring [Non-intrusive auto instrumentation for Golang applications aimed at OpenTelemetry](https://github.com/alibaba/opentelemetry-go-auto-instrumentation/pull/3).

# What's this
The **OpenTelemetry Golang Auto Instrumentation** is designed to be lightweight and easy to use, users build their project by using `otelbuild` instead of `go build`, and the instrumentation code will be injected into the source code automatically. The `otelbuild` tool is responsible for collecting all the dependencies and the available `Rules`, and then generating the so-called **TJump** instrumentation code and injecting it into the source code.

# How it works
In general, the `go build` command goes through the following main steps to compile a Go application:

1. Source Code Parsing: The Go compiler parses the source files into an abstract syntax tree (AST).
2. Type Checking: After parsing, it performs type checks to ensure adherence to the Go type system.
3. Semantic Analysis: The semantics of the program, incuding variable definitions and package imports, are analyzed.
4. Compilation Optimization: The syntax tree is converted into intermediate representation, which undergoes various optimizations to enhance execution efficiency.
5. Code Generation: Machine code for the target platform is generated.
6. Linking: Different packages and libraries are linked into a single executable file.

After using the automatic instrumentation tool, two additional stages are inserted before the above steps: `Preprocess` and `Instrument`.

![](../images/flow.png)

## Preprocess
In this phase, the tool analyzes the dependencies of third-party libraries in the user's project and matches them with existing instrumentation rules to find appropriate instrumentation rules and pre-configure the required additional dependencies for these rules.

Instrumentation rules precisely define which code blocks should be injected for which version of which framework or standard library. Different types of instrumentation rules serve various purposes, with existing types as follows:

- InstFuncRule: Inject code at the entry and exit of a method.
- InstStructRule: Modify a structure to add a new field.
- InstFileRule: Add a new file into the original compilation process.

When all preprocessing work is ready, `go build -toolexec otelbuild cmd/app` is called for compilation. The `-toolexec` parameter is the core of automatic instrumentation, intercepting the standard build process and replacing it with a user-defined tool, allowing developers greater flexibility in customizing the build process. The invoked `otelbuild` is the automatic instrumentation tool that leads into the code injection phase.

## Instrument
The code injection phase inserts trampoline code based on the defined rules for the target functions. Trampoline code is essentially a complex `if-statement` that allows monitoring point code to be injected at the entry and exit of target functions, facilitating the collection of monitoring data. Additionally, multiple optimizations at the AST level are performed to minimize extra performance overhead from trampoline code and optimize execution efficiency.

After completing these steps, the tool modifies the compilation parameters and calls `go build cmd/app` for normal compilation.

# `net/http` Example
We distinguish three types of functions: RawFunc, TrampolineFunc, and HookFunc. RawFunc is the original function to be injected; TrampolineFunc is the trampoline function; and HookFunc includes hooks that need to be inserted at the entry and exit of the original function. RawFunc jumps to TrampolineFunc through the inserted TJump, which prepares the context and error handling before jumping to HookFunc to execute the monitoring code.

![](../images/tjump.png)

Next, using `net/http` as an example, we demonstrate how compile-time automatic instrumentation injects monitoring code into the target function `(*Transport).RoundTrip()`. The framework generates a TJump at the function entry that behaves like such:

```go
func (t *Transport) RoundTrip(req *Request) (retVal0 *Response, retVal1 error) {
    if callContext37639, _ := OtelOnEnterTrampoline_RoundTrip37639(&t, &req); false {
    } else {
        defer OtelOnExitTrampoline_RoundTrip37639(callContext37639, &retVal0, &retVal1)
    }
    return t.roundTrip(req)
}
```

Here, OtelOnEnterTrampoline_RoundTrip37639 is the TrampolineFunc that prepares error handling and context, then jumps to ClientOnEnterImpl for hook function execution:

```go
func OtelOnEnterTrampoline_RoundTrip37639(t **Transport, req **Request) (*CallContext, bool) {
    defer func() {
        if err := recover(); err != nil {
            println("failed to exec onEnter hook", "clientOnEnter")
            if e, ok := err.(error); ok {
                println(e.Error())
            }
            fetchStack, printStack := OtelGetStackImpl, OtelPrintStackImpl
            if fetchStack != nil && printStack != nil {
                printStack(fetchStack())
            }
        }
    }()
    callContext := &CallContext{
        Params:     nil,
        ReturnVals: nil,
        SkipCall:   false,
    }
    callContext.Params = []interface{}{t, req}
    ClientOnEnterImpl(callContext, *t, *req)
    return callContext, callContext.SkipCall
}
```

`ClientOnEnterImpl` is the HookFunc, containing monitoring code where trace and metrics data can be reported. It is dynamically configured during the preprocessing stage in `otel_setup_inst.go`.

Through these steps, we have inserted monitoring code into `(*Transport).RoundTrip()` while ensuring the accuracy of monitoring data and context propagation. In compile-time automatic instrumentation, these operations are automated, saving developers considerable time and reducing error rates in manual instrumentation.