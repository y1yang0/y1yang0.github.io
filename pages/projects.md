---
layout: page
title: Projects
permalink: /projects
---

## OpenJDK
- [2023-03-06 8299518: HotSpotVirtualMachine shared code across different platforms](https://github.com/openjdk/jdk/commit/10d6a8e66a9)
- [2023-03-03 8143900: OptimizeStringConcat has an opaque dependency on Integer.sizeTable field](https://github.com/openjdk/jdk/commit/c961a918ad4)
- [2022-12-26 8288204: GVN Crash: assert() failed: correct memory chain](https://github.com/openjdk/jdk/commit/04591595374)
- [2022-12-07 8290432: C2 compilation fails with assert(node->_last_del == _last) failed: must have deleted the edge just produced](https://github.com/openjdk/jdk/commit/acf96c64b75)
- [2022-03-11 8272493: Suboptimal code generation around Preconditions.checkIndex intrinsic with AVX2](https://github.com/openjdk/jdk/commit/88f0938c943)
- [2022-03-11 8282883: Use JVM_LEAF to avoid ThreadStateTransition for some simple JVM entries](https://github.com/openjdk/jdk/commit/a5a1a32db65)
- [2022-03-08 8275775: Add jcmd VM.classes to print details of all classes](https://github.com/openjdk/jdk/commit/3f0684d0b85)
- [2021-12-23 8278125: Some preallocated OOMEs are missing stack trace](https://github.com/openjdk/jdk/commit/ad1dc9c2ae5)
- [2021-11-30 8267928: Loop predicate gets inexact loop limit before PhaseIdealLoop::rc_predicate](https://github.com/openjdk/jdk/commit/fecf906f0af)
- [2021-11-19 8277102: Dubious PrintCompilation output](https://github.com/openjdk/jdk/commit/2f0bde1a658)
- [2021-11-08 8274328: C2: Redundant CFG edges fixup in block ordering](https://github.com/openjdk/jdk/commit/44047f849fa)
- [2021-10-27 8273585: String.charAt performance degrades due to JDK-8268698](https://github.com/openjdk/jdk/commit/b0d1e4ff4d3)
- [2021-09-22 8272114: Unused _last_state in osThread_windows](https://github.com/openjdk/jdk/commit/11cddd3261e)
- [2021-09-13 8273021: C2: Improve Add and Xor ideal optimizations](https://github.com/openjdk/jdk/commit/a73c06de2ac)
- [2021-09-01 8272377: assert preconditions that are ensured when created in add_final_edges](https://github.com/openjdk/jdk/commit/02822e1398d)
- [2021-08-16 8271203: C2: assert(`iff->Opcode() == Op_If || iff->Opcode() == Op_CountedLoopEnd || iff->Opcode() == Op_RangeCheck`) failed: Check this code when new subtype is added](https://github.com/openjdk/jdk/commit/3f38a50c528)
- [2021-08-05 8270058: Use Objects.check{Index,FromIndexSize} for java.desktop](https://github.com/openjdk/jdk/commit/ea9a59520de)
- [2021-07-28 8270901: Typo PHASE_CPP in CompilerPhaseType](https://github.com/openjdk/jdk/commit/072fe486c95)
- [2021-07-28 8271118: C2: StressGCM should have higher priority than frequency-based policy](https://github.com/openjdk/jdk/commit/ed1cb24027f)
- [2021-07-20 8270307: C2: assert(false) failed: bad AD file after JDK-8267687](https://github.com/openjdk/jdk/commit/0cec11d3eb7)
- [2021-07-14 8270056: Generated lambda class can not access protected static method of target class](https://github.com/openjdk/jdk/commit/0f5470715e9)
- [2021-07-13 8270056: Generated lambda class can not access protected static method of target class](https://github.com/openjdk/jdk/commit/07e90524576)
- [2021-07-13 8268698: Use Objects.check{Index,FromToIndex,FromIndexSize} for java.base](https://github.com/openjdk/jdk/commit/afe957cd974)
- [2021-07-07 8268425: Show decimal nid of OSThread instead of hex format one](https://github.com/openjdk/jdk/commit/a9e201016de)
- [2021-07-06 8269672: C1: Remove unaligned move on all architectures](https://github.com/openjdk/jdk/commit/df0e11bb0ca)
- [2021-07-06 8267956: C1 code cleanup](https://github.com/openjdk/jdk/commit/2926769800d)
- [2021-07-01 8266746: C1: Replace UnsafeGetRaw with UnsafeGet when setting up OSR entry block](https://github.com/openjdk/jdk/commit/d89e630cdf0)
- [2021-06-22 8267657: Add missing PrintC1Statistics before incrementing counters](https://github.com/openjdk/jdk/commit/2e639dd34a4)
- [2021-06-12 8265518: C1: Intrinsic support for Preconditions.checkIndex](https://github.com/openjdk/jdk/commit/5cee23a9ed0)
- [2021-06-04 8267687: ModXNode::Ideal optimization is better than Parse::do_irem](https://github.com/openjdk/jdk/commit/4e6748c543f)
- [2021-06-01 8267089: Use typedef KVHashtable for ID2KlassTable](https://github.com/openjdk/jdk/commit/c2c0208dfd9)
- [2021-05-19 8267151: C2: Don't create dummy Opaque1Node for outmost unswitched IfNode](https://github.com/openjdk/jdk/commit/392f962e0e8)
- [2021-05-19 8267239: C1: RangeCheckElimination for % operator if divisor is IntConstant](https://github.com/openjdk/jdk/commit/0cf7e5784b4)
- [2021-05-18 8265711: C1: Intrinsify Class.getModifier method](https://github.com/openjdk/jdk/commit/905b41ac6ae)
- [2021-05-12 8266798: C1: More types of instruction can also apply LoopInvariantCodeMotion](https://github.com/openjdk/jdk/commit/11759bfb2d8)
- [2021-05-12 8266189: Remove C1 "IfInstanceOf" instruction](https://github.com/openjdk/jdk/commit/548899d40e1)
- [2021-05-12 8266874: Clean up C1 canonicalizer for TableSwitch/LookupSwitch](https://github.com/openjdk/jdk/commit/b46086d777d)
- [2021-05-03 8265322: C2: Simplify control inputs for BarrierSetC2::obj_allocate](https://github.com/openjdk/jdk/commit/001c5142a6f)
- [2021-04-27 8265914: Duplicated NotANode and not_a_node](https://github.com/openjdk/jdk/commit/fbfd4ea3ceb)
- [2021-04-21 8265106: IGV: Enforce en-US locale while parsing ideal graph](https://github.com/openjdk/jdk/commit/b5c92ca34fd)
- [2021-04-19 8265285: Unnecessary inclusion of bytecodeHistogram.hpp](https://github.com/openjdk/jdk/commit/235daea06ae)
- [2021-04-19 8265245: depChecker_cpu don't have any functionalities](https://github.com/openjdk/jdk/commit/fa58aae8f6b)
- [2021-04-19 8265323: Leftover local variables in PcDesc](https://github.com/openjdk/jdk/commit/a2b0e0f4c08)
- [2021-04-12 8264972: Unused TypeFunc declared in OptoRuntime](https://github.com/openjdk/jdk/commit/ecef1fc82b7)
- [2021-04-12 8264644: Add PrintClassLoaderDataGraphAtExit to print the detailed CLD graph](https://github.com/openjdk/jdk/commit/440c34a62b7)
- [2021-04-09 8264881: Remove the old development option MemProfiling](https://github.com/openjdk/jdk/commit/666fd62ee8c)
- [2021-04-06 8264634: CollectCLDClosure collects duplicated CLDs when dumping dynamic archive](https://github.com/openjdk/jdk/commit/54b4070da76)
- [2021-04-01 8264413: Data is written to file header even if its CRC32 was calculated](https://github.com/openjdk/jdk/commit/de495df78d5)
- [2021-03-30 8264429: Test runtime/cds/appcds/VerifyWithDefaultArchive.java assumes OpenJDK build](https://github.com/openjdk/jdk/commit/b65219881da)
- [2021-03-30 8264337: VM crashed when -XX:+VerifySharedSpaces](https://github.com/openjdk/jdk/commit/bcdf4694e07)
- [2021-03-18 8263775: C2: igv_print() crash unexpectedly when called from debugger](https://github.com/openjdk/jdk/commit/3f31a6baa90)
- [2021-03-16 8263562: Checking if proxy_klass_head is still lambda_proxy_is_available](https://github.com/openjdk/jdk/commit/0d2f87e4940)
- [2021-03-13 8256156: JFR: Allow 'jfr' tool to show metadata without a recording](https://github.com/openjdk/jdk/commit/86e4c755f90)
- [2021-02-25 8262099: jcmd VM.metaspace should report unlimited size if MaxMetaspaceSize isn't specified](https://github.com/openjdk/jdk/commit/3a0d6a64bc4)
- [2021-02-22 8261949: fileStream::readln returns incorrect line string](https://github.com/openjdk/jdk/commit/2b555015193)

## Golang
- [2023-03-19 cmd/compile: add rewrite rules for arithmetic operations](https://github.com/golang/go/commit/da4687923b)

## For Fun
- [YVM: Yang's JVM](https://github.com/y1yang0/yvm)
- [NYX: The Nyx Dynamic Scripting Language](https://github.com/y1yang0/nyx)
- [Yarrow: JVMCI based optimizing compiler for HotSpot VM](https://github.com/y1yang0/yarrow)
- [TiebaCloud: My first code project](https://github.com/y1yang0/TiebaCloud)