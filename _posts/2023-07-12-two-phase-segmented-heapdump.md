---
layout: post
title:  "Two-phase segmented heap dump for JVM"
date:   2023-05-27
categories: [Java]
tags: [runtime]
---

### Motivation
Java heap dump brings about pauses for application's execution(so called [Stop The World](https://en.wikipedia.org/wiki/Tracing_garbage_collection#Stop-the-world_vs._incremental_vs._concurrent)), this is a well-known pain. [JDK-8252842](https://bugs.openjdk.org/browse/JDK-8252842) have added parallel support to heapdump in an attempt to alleviate this pain. However, in that patch, all concurrent threads competitively write heap data to the same heap file, and more memory is required to maintain the concurrent buffer queue and related stuff. In experiments, we did not feel a significant performance improvement from that.

The minor-pause solution, which is presented in this article, is a two-phase segmented heap dump:

- **Phase 1(STW)**: Concurrent threads directly write data to multiple heap files. This process must take place during STW, which is guaranteed by [safepoint](https://openjdk.org/groups/hotspot/docs/HotSpotGlossary.html#safepoint)
- **Phase 2(Non-STW)**: Merge multiple heap files into one complete heap dump file. STW is not needed for this phase.

Now concurrent worker threads are not required to maintain a buffer queue, which would result in more memory overhead, nor do they need to compete for locks. The changes in the overall design are as follows:

![](/assets/images/fig1.png)
<p align="center">Fig1. Before</p>

![](/assets/images/fig2.png)
<p align="center">Fig2. After</p>


### Performance evaluation

| memory | numOfThread | CompressionMode | STW | Total |
| -------| ----------- | --------------- | --- | ---- |
| 8g | 1 T | N | 15.612 | 15.612 |
| 8g | 32 T | N | 2.561725 | 14.498 |
| 8g | 32 T | C1 | 2.3084878 | 14.198 |
| 8g | 32 T | C2 | 10.9355128 | 21.882 |
| 8g | 96 T | N | 2.6790452 | 14.012 |
| 8g | 96 T | C1 | 2.3044796 | 3.589 |
| 8g | 96 T | C2 | 9.7585151 | 20.219 |
| 16g | 1 T | N | 26.278 | 26.278 |
| 16g | 32 T | N | 5.231374 | 26.417 |
| 16g | 32 T | C1 | 5.6946983 | 6.538 |
| 16g | 32 T | C2 | 21.8211105 | 41.133 |
| 16g | 96 T | N | 6.2445556 | 27.141 |
| 16g | 96 T | C1 | 4.6007096 | 6.259 |
| 16g | 96 T | C2 | 19.2965783 | 39.007 |
| 32g | 1 T | N | 48.149 | 48.149 |
| 32g | 32 T | N | 10.7734677 | 61.643 |
| 32g | 32 T | C1 | 10.1642097 | 10.903 |
| 32g | 32 T | C2 | 43.8407607 | 88.152 |
| 32g | 96 T | N | 13.1522042 | 61.432 |
| 32g | 96 T | C1 | 9.0954641 | 9.885 |
| 32g | 96 T | C2 | 38.9900931 | 80.574 |
| 64g | 1 T | N | 100.583 | 100.583 |
| 64g | 32 T | N | 20.9233744 | 134.701 |
| 64g | 32 T | C1 | 18.5023784 | 19.358 |
| 64g | 32 T | C2 | 86.4748377 | 172.707 |
| 64g | 96 T | N | 26.7374116 | 126.08 |
| 64g | 96 T | C1 | 16.8101551 | 17.938 |
| 64g | 96 T | C2 | 80.1626621 | 169.003 |
| 128g | 1 T | N | 233.843 | 233.843 |
| 128g | 32 T | N | 72.9945768 | 207.06 |
| 128g | 32 T | C1 | 36.399436 | 37.005 |
| 128g | 32 T | C2 | 172.8942958 | 394.026 |
| 128g | 96 T | N | 67.6815929 | 336.345 |
| 128g | 96 T | C1 | 35.2457306 | 36.23 |
| 128g | 96 T | C2 | 162.2924705 | 397.392 |

<p align="center">Table1. heap dump generation(full)</p>

| memory | numOfThread | STW | Total |
| ------ | ----------- | --- | ----- |
| 8g | 1 T | 15.612 | 15.612 |
| 8g | 32 T | 2.561725 | 14.498 |
| 8g | 96 T | 2.6790452 | 14.012 |
| 16g | 1 T | 26.278 | 26.278 |
| 16g | 32 T | 5.231374 | 26.417 |
| 16g | 96 T | 6.2445556 | 27.141 |
| 32g | 1 T | 48.149 | 48.149 |
| 32g | 32 T | 10.7734677 | 61.643 |
| 32g | 96 T | 13.1522042 | 61.432 |
| 64g | 1 T | 100.583 | 100.583 |
| 64g | 32 T | 20.9233744 | 134.701 |
| 64g | 96 T | 26.7374116 | 126.08 |
| 128g | 1 T | 233.843 | 233.843 |
| 128g | 32 T | 72.9945768 | 207.06 |
| 128g | 96 T | 67.6815929 | 336.345 |

<p align="center">Table2. heap dump generation(w/o compression)</p>

> N.B. all compression benchmark data are based on -gz=9, i.e. strongest compression
> - *N* means no compression
> - *C1* means all objects are byte[] in heap and they are all empty
> - *C2* means all objects are byte[] in heap and they are full of random data
> - *Total* means the total heap dump including both two phases
> - *STW* means the first phase only.
> - For parallel dump, *Total* = *STW* + *Merge*. For serial dump, *Total* = *STW*

![image](/assets/images/fig3.png)

<p align="center">Fig3. heap dump generation(full)</p>

![image](/assets/images/fig4.png)
<p align="center">Fig4. heap dump generation(w/o compression)</p>

In a nutshell, this significantly **reduces 71~83% application pause time**.

When compression is enabled, STW/Total time heavily depends on the sparseness of the application heap. If the heap is full of compressible objects(e.g. all objects are empty byte array), Total ≈ STW, merge process is incredibly fast. If the heap data is not suitable for compression(e.g. all objects are full of random data), the STW reduction is not appealing, the total dump time is also increased.

In actual testing, two-phase solution can lead to an increase in the overall time for heapdump(See table above). However, considering the reduction of STW time, I think it is an acceptable trade-off. Furthermore, there is still room for optimization in the second merge phase. Since number of parallel dump thread has a considerable impact on total dump time, I added a parameter that allows users to specify the number of parallel dump thread they wish to run.

Testing: manual tests, MAT verification of heapdump integrity, all jtreg tests

### Future work
- Add parallel heap dump support for HeapDumpBeforeFullGC,HeapDumpOnOutOfMemoryError etc
- Add parallel heap dump during performing JMX HotSpotDiagnosticMXBean.dumpHeap
- Merge segmented heap dump files by spawning new virtual thread
- Optimization of file merging by send_file instead of read-write combination
- Add parallel option for jmap
- Refactor, including remove AbstractDumpWriter etc