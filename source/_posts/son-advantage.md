---
layout: post
title:  "Sea of Nodes IR Advantages"
date:   2026-01-21
categories: [Compiler]
---

I've seen questions on online forums asking about the primary advantage of a **Sea of Nodes (SoN) IR** compared to a traditional **SSA-based IR** like LLVM's. This inspired me to write an article to share my perspective. It's been a while since I worked on JVM development, and I don't claim to be an expert, so this is just my personal understanding, offered for reference.

Consider the following code:
```java
static int test(double d, int cond) {
  int p = 13;
  if (cond == 5) {
    double x = d / 3.; // line 4
    p += (int)x;
  } else {
    p -= cond;
  }
  double x2 = d / 3.; // duplicate with line 4
  p += (int)x2;
  return p;
}
```

**The great advantage of a Sea of Nodes (SoN) IR is that during its construction, control flow can be ignored. Data nodes float freely, untethered from the traditional constraints of the def-use relationship.** In my opinion, this is its single greatest strength.

In the example above, we can spot the redundant calculation on lines 4 and 9. Even though the definition (def) on line 4 does not dominate the code path leading to the use on line 10, SoN can still identify and reuse the value. This is because the Global Code Motion (GCM) pass (specifically, the [algorithm](https://dl.acm.org/doi/10.1145/207110.207154) Cliff Click proposed for SoN IR) will resolve the placement of these nodes.

![](../images/ir-son.png)
![](../images/ir-son2.png)

In contrast, value numbering in a traditional SSA IR is typically based on a dominator tree. It must respect the rule that a definition must dominate all its uses. If a definition is in one branch (the if block) and a potential reuse is in a later block not dominated by the first, a traditional value numbering pass cannot see this opportunity and thus cannot eliminate the redundancy. This is the core advantage of SoN over traditional IRs, and the GCM algorithm is a natural consequence of this design.

![](../images/ir-ssa.png)

In a SoN graph, data nodes are "globally floating," free from the shackles of a CFG. Value numbering is inherently global and doesn't need to consider the dominator tree. Nodes can be uniqued simply by hashing their inputs and operation. As a result, the parsing phase ensures that only one instance of any given calculation exists in the graph, effectively eliminating redundancy from the start.

This "floating" property has another major benefit: GCM effectively performs Loop-Invariant Code Motion (LICM) for free. Before the GCM phase, the optimizer doesn't need to be aware that a Div node is inside a loop; it can be treated like any other node. Later, the "schedule early" phase of GCM will naturally hoist it out of the loop. LICM becomes an emergent property of the GCM algorithm, not a separate, complex pass.

![](../images/ir-son3.png)

Many cheap, powerful optimizations occur during this "liquid" parsing stage, which can reduce the size of the IR and simplify subsequent optimization phases. However, after the GCM pass is complete, the IR becomes "fragile." This means it has been solidified into a structure that is very similar to a traditional SSA+CFG form. At this point, the "floating" property is lost, and with it, the ability to perform dominance-free global value numbering.


References:
- [A Simple Graph-Based Intermediate Representation](https://www.oracle.com/technetwork/java/javase/tech/c2-ir95-150110.pdf)
- [From_Quads_to_Graphs_An_Intermediate_Representation's_Journey](https://softlib.rice.edu/pub/CRPC-TRs/reports/CRPC-TR93366-S.pdf)
- [C2 The JIT In HotSpot](https://assets.ctfassets.net/oxjq45e8ilak/12JQgkvXnnXcPoAGoxB6le/5481932e755600401d607e20345d81d4/100752_1543361625_Cliff_Click_The_Sea_of_Nodes_and_the_HotSpot_JIT.pdf)