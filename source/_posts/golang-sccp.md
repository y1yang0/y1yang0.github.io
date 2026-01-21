---
layout: post
title:  "Sparse Conditional Constant Propagation in Golang"
date:   2023-05-27
categories: [Compiler, Golang]
---

### Introduction

Recently, I implemented [Sparse Conditional Constant Propagation(SCCP)](https://github.com/golang/go/commit/4ee1d542eda8d8aab7ca2024a4a0a9068d3cad70) in Golang.

SCCP is an old but useful optimization, the detailed algorithm was described in [Mark N. Wegman, F. Kenneth Zadeck: Constant Propagation with Conditional Branches TOPLAS 1991](https://www.cs.wustl.edu/~cytron/531Pages/f11/Resources/Papers/cprop.pdf).

This algorithm uses three level lattice for SSA value

```
      Top        undefined
     / | \
 .. 1  2  3 ..   constant
     \ | /
     Bottom      not constant
```

It starts with optimistically assuming that all SSA values are initially Top and then propagates constant facts only along reachable control flow paths Since some basic blocks are not visited yet, corresponding inputs of phi become Top, we use the `meet(phi)` to compute its lattice.

```
    Top ∩ any = any
    Bottom ∩ any = Bottom
    ConstantA ∩ ConstantA = ConstantA
    ConstantA ∩ ConstantB = Bottom
```

Each lattice value is lowered most twice(Top to Constant, Constant to Bottom) due to lattice depth, resulting in a fast convergence speed of the algorithm.

### SCCP Example

The following is a typical example that demonstrates the benefits of SCCP compared to various optimization combinations:

```go
//go:noinline
func dummy() {}

//go:noinline
func tt() {
	for i := int64(0); i >= 128; i++ {
		dummy()
	}
}
```

The corresponding SSA is as follows:

```
b1:
v1 (?) = InitMem <mem>
v4 (?) = Const64 <int64> [0] (i[int64])
v6 (?) = Const64 <int64> [128]
v12 (?) = Const64 <int64> [1]
Plain → b2 (+91)

b2: ← b1 b4
v5 (91) = Phi <int64> v4 v13 (i[int64])
v16 (94) = Phi <mem> v1 v10
v7 (+91) = Leq64 <bool> v6 v5
If v7 → b4 b5 (likely) (91)

b4: ← b2
v9 (+92) = StaticCall <mem> {AuxCall{main.dummy}} v16
v10 (92) = SelectN <mem> [0] v9
v13 (+91) = Add64 <int64> v5 v12 (i[int64])
Plain → b2 (91)

b5: ← b2
v14 (+94) = MakeResult <mem> v16
Ret v14 (94)
```

Initially, SCCP propagates constants along b1->b2. When it encounters `v5#Phi`, it optimistically assumes that the lattice of v13, which is the second parameter of the Phi and has not been visited in basic block b4, is Top. It calculates a constant lattice of value 0 for `v5 = Phi(Const,Top)`. Then, `v7 (+91) = Leq64 <bool> v6 v5(128 <= 0)` evaluates to false and is used as the control value to determine subsequent control flow, so only b2->b5 is propagated. Finally, the control flow ends. The transformed SSA is as follows:
```
b5:
v1 (?) = InitMem <mem>
v14 (+94) = MakeResult <mem> v1
Ret v14 (94)
```
The entire loop is removed. In this way, SCCP can discover optimization opportunities that cannot be found by just combining constant folding and constant propagation and dead code elimination separately.

This advantage is usually manifested when code involves loops. Because loops have back edges, which often produce uncertain Phi values that are difficult to prove as constants in other optimizations, SCCP can take advantage of this. According to the aforementioned rules, SCCP simulates execution along the control flow and when it encounters a Phi, it can optimistically assume that the Phi is a constant and continue propagating constant facts along the control flow based on this assumption.

### Performance evaluation
In practice, when to run SCCP is also something worth considering. Running SCCP optimization in the early stages of compilation can identify more constants, eliminate more dead code, and fold more constant calculations. Running SCCP in the later stages of compilation can discover optimization opportunities that were not found by earlier optimizations. We compared the performance of running SCCP at different critical stages:

| Placement | Constant | Deadcode |
| --------- | -------- | -------- |
| before early deadcode | 451088 | 96553 |
| before pre-opt deadcode | 329419 | 116650 |
| before opt deadcode | 6078 | 765 |
| before gcse deadcode | 3539 | 763 |
| before generic deadcode | 2735 | 545 |
| before lower | 2444 | 535 |

I conservatively propose to only place SCCP before `generic deadcode`. Ideally I think it should be performed both before `generic deadcode` and before `early deadcode`

### Future work
There is still a lot of work to be done in the future, and here are some that come to my mind at the moment (in order of difficulty):

- Support more basic constant types, such as OpConstNil, OpConstString
- Support constant folding for more operations
- Extend the constant lattice, implement value range propagation, at least achieving what prove pass can currently do, and eventually removing prove pass.
- Support interprocedural SCCP that awares of function invocations.