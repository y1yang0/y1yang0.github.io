---
layout: post
title:  "Compiler Pass Checklist"
date:   2023-05-27
categories: ['Compiler']
tags: [compiler]
---

## Capability

| Pass |LangOnly | Java/C2 | Java/Graal | Java/C1 | Golang | Php | C++/LLVM | C++/GCC |
| ---- | ------- | ------- | ---------- | ------- | ------ | --- | -------- | ------- |
| Constant folding                          |   | Y | Y | Y | Y | Y | Y | Y |
| Local optimization                        |   | Y | Y | Y | Y | Y | Y | Y |
| Inline                                    |   | Y | Y | Y | Y | Y | Y | Y |
| Dead code elimination                     |   | Y | Y | Y | Y | Y | Y | Y |
| Common subexpression elimination          |   | Y | Y | Y | Y |   | Y | Y |
| Global CSE                                |   | Y | Y |   | Y |   | Y | Y |
| Sparse conditional constant propagation   |   | Y | Y |   |   | Y | Y | Y |
| Interprocedural SCCP                      |   |   |   |   |   |   | Y | Y |
| Simplify CFG                              |   | Y | Y | Y | Y | Y | Y | Y |
| Dominator optimizations                   |   | Y | Y |   | Y |   | Y | Y |
| Auto-vectorization                        |   |   |   |   |   |   | Y | Y |
| Reassociate                               |   | Y | Y |   |   |   | Y | Y |
| Tail-call elimination                     |   |   |   |   |   |   | Y | Y |
| Load/Store elimination                    |   | Y | Y |   | Y |   | Y | Y |
| Merge functions                           |   |   |   |   |   |   | Y |   |
| Escape analysis                           | o | Y | Y |   | Y |   |   |   |
| Partial escape analysis                   | o |   | Y |   |   |   |   |   |
| Alias analysis                            |   |   |   |   |   |   | Y | Y |
| Dependence analysis                       |   |   |   |   |   |   | Y |   |
| Jumping thread                            |   | Y | Y |   | Y |   | Y | Y |
| Scalar replacement                        |   | Y | Y |   | Y |   | Y | Y |
| Div/Mod optimization                      |   | Y | Y |   | Y |   | Y | Y |
| Intrinsify                                |   | Y | Y | Y | Y |   | Y | Y |
| Value range propagation                   |   |   |   |   |   |   | Y | Y |
| Devirtualization                          | o | Y | Y | Y | Y |   | Y | Y |
| Profile-guided optimization               |   | Y | Y | Y | Y |   | Y | Y |
| Loop unroll                               |   | Y | Y |   |   |   | Y | Y |
| Loop predication                          | o | Y | Y |   |   |   |   |   |
| Loop split                                |   | Y |   |   |   |   |   | Y |
| Loop rotation                             |   | Y | Y |   | Y |   | Y | Y |
| Loop unswitch                             |   | Y | Y |   |   |   | Y | Y |
| Loop invariant code motion                |   | Y | Y | Y |   |   | Y | Y |
| Loop strip mining                         |   | Y | Y |   |   |   |   | Y |
| Loop extract                              |   |   |   |   |   |   | Y |   |
| Loop vectorization                        |   | Y |   |   |   |   | Y | Y |
| Auto-parallelization                      |   |   |   |   |   |   |   | Y |
| Polyhedral loop optimization              |   |   |   |   |   |   | Y | Y |
| Range check elimination                   | o | Y | Y | Y | Y |   |   |   |
| Null check elimination                    | o | Y | Y | Y | Y |   |   |   |
| Lock elimination                          | o | Y | Y |   |   |   |   |   |
| Boxing elimination                        | o | Y | Y |   |   |   |   |   |
| Array copy optimization                   | o | Y | Y |   |   |   | Y | Y |
| Return value optimization                 |   |   |   |   |   |   | Y | Y |
| Dead argument elimination                 |   |   |   |   |   |   | Y |   |
| Dead global elimination                   |   |   |   |   |   |   | Y | Y |
| Lowering                                  |   | Y | Y | Y | Y | Y | Y | Y |
| Block ordering                            |   | Y | Y |   | Y |   | Y | Y |
| Instruction scheduling                    |   | Y | Y |   | Y |   | Y | Y |
| Instruction peephole                      |   | Y |   |   | Y |   | Y | Y |
| Register allocation                       |   | Y | Y | Y | Y | Y | Y | Y |

## Brief

| Pass | Brief                                                                                   |
| ---- | --------------------------------------------------------------------------------------- |
| Constant folding | Compile-time evaluation                                                     |
| Local optimization | Local optimization for IR items                                           |
| Inline | Bottom-up inlining of functions into callees                                          |
| Dead code elimination | Dead code elimination                                                  |
| Common subexpression elimination | Common subexpression elimination                            |
| Global common subexpression elimination | Global common subexpression elimination              |
| Sparse conditional constant propagation | sparse conditional constant propagation              |
| Interprocedural SCCP | Interprocedural sparse conditional constant propagation                 |
| Simplify CFG | Collection of optimizations at CFG level                                        |
| Dominator optimizations | Collection of dominator tree based optimizations                     |
| Auto-vectorization | Performs vectorization of straight-line code                              |
| Reassociate | Reassociate commutative expressions                                              |
| Tail-call elimination | Transform tail-call to a loop                                          |
| Load/Store elimination | eliminate multiple/redundant reload/store                             |
| Merge functions | Looks for equivalent functions that are mergeable and folds them             |
| Escape analysis | Identify non-escape objects                                                  |
| Partial escape analysis | Identify flow-sensitive non-escape objects                           |
| Alias analysis |  Identify whether or not two pointers can point to same object in memory      |
| Dependence analysis | Detect dependences in memory accesses                                    |
| Jumping thread | Remove unnecessary jmp when involving two Ifs                                 |
| Scalar replacement | Unpack aggregate type into individual variables                           |
| Div/Mod optimization | Convert a division by constant divisor into efficient form              |
| Intrinsify | Handwritten IR for important functions                                            |
| Value range propagation | Determines what subranges a variable can contain                     |
| Devirtualization | Replace virtual calls to direct calls                                       |
| Profile-guided optimization | Use profiling data for further optimizations                     |
| Loop unroll | Unroll loop                                                                      |
| Loop predication | Insert loop predicates for null checks and range checks                     |
| Loop split | Split loop into pre/main/post loops                                               |
| Loop rotation | Converts loops into do/while style loop                                        |
| Loop unswitch | Clone loop body and test invariant earlier                                     |
| Loop invariant code motion | Looop invariant code motion                                       |
| Loop strip mining | Partitions long-counted loop iteration into smaller chunks                 |
| Loop extract | Extract loop into new functions                                                 |
| Loop vectorization | Transforms loops to operate on vector types instead of scalar types       |
| Auto-parallelization | Splits the loop iteration space to run into several threads             |
| Polyhedral loop optimization | Modeling integer polyhedra for program to analyze and optimize  |
| Range check elimination | Eliminate redundant range check                                      |
| Null check elimination | Eliminate unnecessary null check                                      |
| Lock elimination | Eliminate or coalesce locks                                                 |
| Boxing elimination | Inline `valueOf()`                                                        |
| Array copy optimization | memset/memcpy/System.arraycopy/etc                                   |
| Return value optimization | Avoid copying an object that a function returns as its value       |
| Dead argument elimination | Removes arguments which are directly dead                          |
| Dead global Elimination | Eliminate unreachable internal globals                               |
| Lowering | Lowering IR forms into machine-dependent ones                                       |
| Block ordering | Reordering layout of basic blocks                                             |
| Instruction scheduling | Schedule instruction into proper location                             |
| Instruction peephole | Local optimization for instructions                                     |
| Register allocation | Allocate physical register for IR items                                  |


> Please feel free to add or correct them.