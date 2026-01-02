---
layout: post
title: "SmallGPT Training Notes"
date: 2026-02-27
categories: [AI]
---

Recently, I implemented a minimal [SmallGPT](https://github.com/y1yang0/smallgpt) for learning purposes and trained it on
a fairly small dataset. I want to share some notes and thoughts on the training process.

## Training on GPU

我在H20-like机器上训练出来了下面的模型：

```json
{
    "dimEmb": 512,
    "numLayer": 8,
    "maxWindowSize": 512,
    "dropoutRate": 0.0,
    "learningRate": 3e-4,
    "numEpoch": 6,
}
```

它基本上是一个74831872参数量(75M)的模型，数据集使用金庸的全部小说，loss1.x左右，smallgpt最终会在2~词左右犹豫并输出，从指标上看应该可以了，但是推理效果非常不理想：

```
@@ Input: 请写一段两个人比武的描写
@@ Output: 请写一段两个人比武的描写一段。”说着向韦春芳瞧去。�
@@ Input: 杨过是谁
@@ Output: 杨过是谁？”苏州的种种种种种种�
@@ Input: 小龙女爱
@@ Output: 小龙女爱惜，她的好抚这小子，她的好抚�
```

我认为问题可能是没有多头注意力，另外询问LLM后，它还提到三个严重的问题：

1. tokenizer不适合中文分词
2. 一个数据集最好是一本书作为一个整体，而不是每一行作为一条数据集
3. argmax是贪心算法，缺少创造性

都是比较简单的问题，来挨个解决一下。

## Temperature sampling

实现了temperature sampling之后，推理效果似乎好了一些，至少没有重复字了，但是模型智力应该完全没有提升，
因为本质上只是吐下一个词的时候从贪心算法变成了概率采样算法，思考过程并没有任何变化。
```
@@ Input: 杨过和小龙女在
@@ Output: 杨过和小龙女在这里等候里干什么，你也不用�
@@ Input: 神雕大侠
@@ Output: 神雕大侠为神拳中致尔致小说，果然不�
@@ Input: 韦小宝和双儿
@@ Output: 韦小宝和双儿子大家都不到慈宁宫去见王爷、是谜
@@ Input: 围攻光明顶
@@ Output: 围攻光明顶。须眉头御杨已断，收到好处�
```

另外喂数据的方式也稍微改变了一下，遵循LLM的建议，现在金庸15本书整体作为一个数据集，加载到内存，然后512的滑动窗口在提取(input,target)chunk送入训练，最终推理效果依然没有太大提升。

## Multi-head attention

我一直认为缺少多头注意力是提升智能的关键，因为毕竟多个头可以关注不同的topic，单头只能关注一个。
所以完成上面的简单工作之后，我将单头注意力替换为了多头注意力。

最开始我的实现是，使用符合直觉的，但是可能会慢一些的方式，即用python list报错多个头，然后用for循环
来进行多次矩阵运算，类似这样
```python
class Attention:
    def __init__(self, config):
        ...
        self.wQuery = [torch.nn.Parameter(...) for _ in range(config["numHead"])]
        self.wKey = [torch.nn.Parameter(...) for _ in range(config["numHead"])]
        self.wValue = [torch.nn.Parameter(...) for _ in range(config["numHead"])]
        ...

    def compute(self, x):
        for i in range(config["numHead"]):
            query = x @ self.wQuery[i]
            key = x @ self.wKey[i]
            value = x @ self.wValue[i]
            attnScore = query @ key.T / (dimHead ** 0.5)
            ...
        return torch.cat(outputs, dim=-1)
```
但是我没有想到训练速度会慢了这么多。我印象里，之前一次训练20min左右，使用这种方式后，训练大概是40min一次。

所以我又换了标准的形式，还是使用三个大矩阵表示Q,K,V，但是使用view来逻辑上拆分成多头。
```python
class Attention:
    def compute(self, x):
        query = x @ self.wQuery
        key = x @ self.wKey
        value = x @ self.wValue
        inputLen, dimEmb = x.shape
        dimHead = dimEmb // self.numHead
        queries = query.view(inputLen, self.numHead, dimHead).transpose(0, 1)
        keys = key.view(inputLen, self.numHead, dimHead).transpose(0, 1)
        values = value.view(inputLen, self.numHead, dimHead).transpose(0, 1)
        # Q(numHead, inputLen, dimHead) @ K^T(numHead, dimHead, inputLen)
        # = attnScore(numHead, inputLen, inputLen)
        attnScore = queries @ keys.transpose(-2, -1) / (dimHead ** 0.5)
        # attnScore(numHead, inputLen, inputLen) @ mask(numHead, inputLen, inputLen)
        # = maskedAttnScore(numHead, inputLen, inputLen)
        mask = torch.tril(torch.ones(inputLen, inputLen, device=x.device))
        attnScore = attnScore.masked_fill(mask == 0, -torch.inf)
        attnWeights = torch.softmax(attnScore, dim=-1)
        attnWeights = self.dropout(attnWeights)
        # (numHead, inputLen, inputLen) @ (numHead, inputLen, dimHead)
        # = out(numHead, inputLen, dimHead)
        out = attnWeights @ values
        out = out.transpose(0,1).contiguous().view(inputLen, dimEmb)
        return out @ self.wOut
```

实现过程中遇到一些困惑点。比如直觉上我认为(inputLen, dimEmb)的tensor，使用多头后应该是(numHead, inputLen, dimHead)的tensor，但是LLM告诉我应该view(inputLen, numHead, dimHead).transpose(0, 1)，我手动验证了一下才发现确实是这样的：
```python
>>> query = torch.tensor([[ 0,  1,  2,  3,  4,  5],
         [ 6,  7,  8,  9, 10, 11]])
>>> query.view(3,2,2)
tensor([[[ 0,  1],
         [ 2,  3]],
        [[ 4,  5],
         [ 6,  7]],
        [[ 8,  9],
         [10, 11]]])
>>> query.view(2,3,2).transpose(0, 1)
tensor([[[ 0,  1],
         [ 6,  7]],
        [[ 2,  3],
         [ 8,  9]],
        [[ 4,  5],
         [10, 11]]])
```
这样view(inputLen, numHead, dimHead).transpose(0, 1)之后，就得到了(numHead, inputLen, dimHead)的tensor。

使用多头注意力之后，推理的效果似乎好了一些：
```
@@ Input: 杨过和小龙女在
@@ Output: 杨过和小龙女在而跪，官量中土竹，果然是中国�
@@ Input: 神雕大侠
@@ Output: 神雕大侠，指挥武官，都去慰染身�
@@ Input: 韦小宝和双儿
@@ Output: 韦小宝和双儿子大起称为“广东平西王带兵是谁
@@ Input: 围攻光明顶
@@ Output: 围攻光明顶，人数可好，他们就此信了。”
@@ Input: 郭靖和黄蓉
@@ Output: 郭靖和黄蓉同时军心等语要说，听了舒化�
@@ Input: 张无忌
@@ Output: 张无忌的揖折批了井本来的秘密，惟而
@@ Input: 令狐冲说
@@ Output: 令狐冲说来，那是田重特别的土好事。这是我�
@@ Input: 华山论剑
@@ Output: 华山论剑阵结成，等候的其实不给内情
@@ Input: 桃花岛上
@@ Output: 桃花岛上的好脚，为中国中国的中国家贼逃�
@@ Input: 少林寺
@@ Output: 少林寺中的大夫所知之策等语，又不知皇
@@ Input: 降龙十八掌
@@ Output: 降龙十八掌的，比众小官使得甚高。（韦绢�
```

## Jinyong-specific tokenizer

虽然Tokenizer很重要，但是我对实现它的兴趣不大，所以网上随便找了一份代码，使用huggingface/tokenizer来基于当前dataset训练了一个tokenizer。词表大小设置为20000，模型参数从75M爆降到46M，几乎缩小了一半，想了想缩小的部分应该就是tokenEmbedding和out，我理解前一个是查表，后一个是思考之后向量转回id，我估计模型智慧并不会降低，先这样吧。

但是这里我犯了个错误，网上随便找的分词器用的byte-level，导致最后乱码：

```python
tokenizer.pre_tokenizer = ByteLevel()
# @@ Input: 杨过和小龙女在
# @@ Output: Ġ æĿ¨è¿ĩåĴĮå°ıé¾Ļå¥³ åľ¨ èĴ²åĽ¢ ä¸ĭ éĤ£ åľŁ æĹĹ äºº ä¸´ ï¼ļ Ċ ãĢĢ ãĢĢ é¡¾çĤİæŃ¦ éģĵ ï¼ļâĢľ éŁ¦é¦Ļä¸» åĲ©åĴĲ ä¸Ń è¿Ļä¸Ģ å¥Ĺ æĪĳ è¿Ľ åĳĪ æĬļ ï¼Į è·ŁçĿĢ å¤§äºº ãĢĤâĢĿ Ċ ãĢĢ ãĢĢ
```

白忙活一场，只能重头再来，先训练tokenizer再训练模型。
这一次训练了10个epoch，loss 3.x，e^3.x≈20，说明smallgpt基本在20~30词左右犹豫并输出
```
@@ Epoch: 0 Progress: 99.99% Loss: 7.1547
...
@@ Epoch: 9 Progress: 99.99% Loss: 3.8123
```
中文分词优化后，推理效果提升巨大，我的理解是smallgpt不再需要学习将6个byte当作一个token的能力（比如"杨过"是一个整体），天生获得了这个能力，它的参数可以关注其他更重要的语法和语义。
```
@@ Input: 杨过和小龙女在
@@ Output: 杨过和 小龙女 在 沐剑屏 怀里 低声 。 七个 夫妻 相处 ， 韦小宝 化 装 清风 来 ， 多隆 和 康熙 西征 ， 乾 清 王府中 共 享 大名 格 等 ， 要 来的
@@ Input: 神雕大侠
@@ Output: 神雕 大侠 ， 一条 长 枪 刺死 ， 鬼 口 ， 今日 鞑子兵 也不知 杀头 还是 奉 旨 ， 弃 斩 ， 挺 有 忠 ， 死 约会 。 ” 韦小宝道 ：
@@ Input: 韦小宝和双儿
@@ Output: 韦小宝和 双儿 、 李力世 、 钱老本 等 四人 走入 书房 的 艇 首 坐下 ， 都觉 心有 快 。 韦小宝 又叫 曾柔 进来 ， 当即 站起 。 韦小宝 吩咐 道 ： “
@@ Input: 围攻光明顶
@@ Output: 围攻 光明顶 走一 举 ， 视 曹 寅 四周 设 说 治 奏 折 中 修 造 奏 折 公 ， 和 顺势 向 康熙 请教 ， 反 大人 恭 请 顾
@@ Input: 郭靖和黄蓉
@@ Output: 郭靖 和 黄蓉 商议 ， 只听得 双儿 和 曾柔 二人 都 聚 一些 ， 众人 知道 韦小宝 为了 这件事 。 苏荃 道 曾柔 说了 七个 “ 韦香主 ” 三字 ， 只得 依言 转身
@@ Input: 张无忌
@@ Output: 张无忌 这么 一分 ， 登时 脸上 溅 上 毛 ， 慢慢 低头 ， 容色 艳 丽 ， 一阵 晕眩 ， 韦小宝 忙 缩回 ， 大声道 ： “ 你去 吧 。 ”
@@ Input: 令狐冲说
@@ Output: 令狐冲 说 ： 你答允 我来 跟 韦香主 理 小玄 架子 ， 要 咱们 生气 ， 天地会 众兄弟 不幸 惨 报 告 。 除了 之女 之外 ， 其余 众位兄弟 韦小宝 一人 推举 帮主
@@ Input: 华山论剑
@@ Output: 华山论剑 ， 倘若 天地会 下手 败 露 ， 他 反而 坏了 陈近南 的下落 。 我师父 之力 既 不在 灭 天地会 ， 却 不及 这恶贼 ， 其余 天地会 会众 已 打死 了一个
@@ Input: 桃花岛上
@@ Output: 桃花岛上 向你 磕头 真假 ， 那是 万万 不干 好 。 他 心里 总不能 记着 各 生 眼睛 衰 好 ， 这才 出 心 去 ， 赵 大哥 要做 天地会的 香主 ，
@@ Input: 少林寺
@@ Output: 少林寺 我是 知道的 。 听说 一部 反贼 办事 ， 财 程 明 ， 你们 的事 长 ， 有 生 不了 事 。 划 明 皇上 本书 、 书 什么的 ， 还
@@ Input: 降龙十八掌
@@ Output: 降龙十八掌 的名字 。 韦小宝笑道 ： “ 皇上 说 奴才 不敢 忘了 。 ” 康熙道 ： “ 别说 皇帝 义气 是 没有 好处 ， 我这 皇帝 是 鸟 生 鱼 汤 ，
```

## Dataset shuffle

我的数据集构建方式是把15本书拼成一个超大字符串，然后每513token作为一个chunk([0:512],target[1:513])，最终数据集是[chunk1,chunk2,...]
我给数据集加了random.shuffle，并且epoch调整到20，最终loss降低到了2.x的水平，但是推理结果好像反而更差了
```
@@ Input: 杨过和小龙女在
@@ Output: 杨过和 小龙女 在 饭铺 外 睡着 相助 找寻 ， 发觉 她 眼光 自 较 ， 兀自 鼓 励 心神 ， 心 无所 定 ， 心花怒放 ， 说道 ： “ 小姑娘 ， 你怎么 来的
@@ Input: 神雕大侠
@@ Output: 神雕 大侠 ， 你一 听 从 直 说到 ‘ 仇 报 德 ’ ， 他 还是 惹 他 生气 的 ？ 然而 耿 派了 、 广东 、 西夏 各 赐 一条 羊
@@ Input: 韦小宝和双儿
@@ Output: 韦小宝和 双儿 满脸 喜悦 的神色 ， 却 缓缓 藏在 计策 的 骷髅 像 ， 单 做 下了 人 。 那 假 造 的 套 女 既有 罗刹 鬼 ， 总是 每 几天
@@ Input: 降龙十八掌
@@ Output: 降龙十八掌 ” 中的 倒 立 于 不败 的脸上 寡妇 然 无 拳 ， 在 对方 身上 刺 了一 孔 ， 刺 之 犹 羞 涩 。 跟着又 极力 劝阻 ， 脸上
```
我理解虽然shuffle避免过拟合，但是shuffle也打乱了模型理解一本书的叙事连续性，所以效果反而更差了？我决定试试shuffle开启关闭的具体效果。
另外现在看来loss指标已经不能准确说明推理效果了，所以我改了一下，每轮epoch训练之后，走一遍推理，肉眼看看推理效果。

**predict_every_epoch+shuffle**:
```shell
@@ Input: 神雕大侠
@@ Epoch: 0  Output: 神雕 大侠 ， 一条 长 绘 ？ ” 阿九 悄声道 ： “ 你叫我 这 书生 ， 咱 。 要救 你的 ， 老毒物 挺 甚为 清楚 ， 难道 ， 岂不是 不是你 。 ”
@@ Epoch: 1  Output: 神雕 大侠 ！ ” 正想 在一 揖 ， 悄声道 ： “ 师父 ， 这是 少林 掌门人 下了 事 的 ， 若非 你 创 教 解药 ， 那是 当世 更 有一 场 ，
@@ Epoch: 2  Output: 神雕 大侠 。 ” 不觉 一惊 ， 背上 竟没 几 面 ， 又叫 ： “ 是 石庄主夫妇 ， 我 送 回 大理 池 之 末 。 ” 解开 二人 的性命 ， 取出一
@@ Epoch: 3  Output: 神雕 大侠 ， 不敢 请教 。 ” 盈盈 说道 ： “ 我们 要 投 着 性命 ， 此后 一定 同时 回来 ， 但此时 却 要你 答允 ， 咱们 万万 不敢 罢手 。
@@ Epoch: 4  Output: 神雕 大侠 ， 请你 ， 给我 雇 一条 命 。 ” 陆 展 元 谷 顶 女侠 ， 说 任 掌教 兄妹 ， 好生 失望 ， 又 叹了口气 ， 摇了摇头 ， 说道
@@ Epoch: 5  Output: 神雕 大侠 。 ” 于是 两人 漫 游 宫中 游 客 ， 竟 不得 晓 路 。 杨康 却 全 盘 山 倒 ， 走进 店 房 ， 沿途 村 镇 。
@@ Epoch: 6  Output: 神雕 大侠 十九 向 无敌 鱼 禀报 ， 就 回 自己 幼时 去了 。 没说 啊 ！ 倘若我 真是 我的 意中人 ， 却又 会 加害
@@ Epoch: 7  Output: 神雕 大侠 ， 神雕 不耐烦了 ， 但 奇怪 的 几句话 竟 泄露 了 。 甄志丙 脸色 间 并不 甚 特异 ， 但此时 见他 眼望 杨过 ， 就此 一 目 ， 想要 争辩
@@ Epoch: 8  Output: 神雕 大侠 主 这一拳 无声无息 ， 很 怕你 。 黄蓉 此时 不论如何 原委 ， 惟 忠 知他 心意 ， 却 遭 此 横 棒 细 棒 刺中 他胸口 膻中穴 。 郭靖 此时
@@ Epoch: 9  Output: 神雕 大侠 给自己 。 无色 知他 虽 不是 杨过 ， 沉吟片刻 ， 脸色 一 白 ， 见 二道 倒 唇 相 看 ， 倒 跃出 鼻 管 。 杨过 身中 玉蜂针 ，
@@ Epoch: 10 Output: 神雕 大侠 细 密 ， 眼中 登时 粘 着一 块 岩石 出来 ， 飞 迅 雷 鸣 ， 通 体 落地 。 杨过 眼见 是 李莫愁 ， 要 设法 抢夺 小龙女 克制
@@ Epoch: 11 Output: 神雕 大侠 昂 首 ， 使 他日 常 带 阴 获 解 之人 而 少 ， 不禁 为之 狂 喜 。 一灯 却 指着 中间 的 脑海中 出神 ： “ 此人 年轻

@@ Input: 韦小宝和双儿
@@ Epoch: 0  Output: 韦小宝和 双儿 得 你的 武功 ， 已经 尽力 善罢 ， 只怕 他也 说 ， 今后 做 帮主 ， 待会 他 这句话 心狠手辣 。 她 从来没 泄露 伤心 ， 哈哈 ！ ” 樊一翁
@@ Epoch: 1  Output: 韦小宝和 双儿 虽然 不好 。 ” 拖雷 道 ： “ 我是 在 江南 来的 ， 可惜 。 ” 韦小宝道 ： “ 我 韦小宝 倒 太后 ！ ” 问 ： “ 我 说道
@@ Epoch: 2  Output: 韦小宝和 双儿 。 ” 自必 奇妙 ， 韦小宝 忍 住了 阿珂 ， 却不 睬 那少女 说话 ， 脸上 更无 异状 ， 甚是 焦急 。 阿珂 知 阿珂 一人 站在 后堂 ， 绝非
@@ Epoch: 3  Output: 韦小宝和 双儿 以及 方怡 ， 忍不住 嗯了一声 。 韦小宝 背上 推拿 数下 ， 正要 再 刺 她 头脸 ， 喝道 ： “ 小 贱人 ， 你 乖乖 不得了 么 ？ ” 韦小宝
@@ Epoch: 4  Output: 韦小宝和 双儿 ， 只叫 他 话 吗 ？ 是 三十六 营 的名 声 记号 。 ” 双儿 粗 眉 梅花 ， 怒道 ： “ 要不要 鬼鬼祟祟 地 说出来 ？ 你这小 鬼 子的
@@ Epoch: 5  Output: 韦小宝和 双儿 闯 下 海 ， 自 下 神龙岛 。 施琅 还在 仔细 ， 想起 一事 ， 今日 又 伤了 施琅 之心 ， 实是 愧 惶 之 切 。 知 南 怀
@@ Epoch: 6  Output: 韦小宝和 双儿 伴 着 双儿 的背影 走去 。 伤势 不用 再 进去 。 双儿 稳 卧 伤口 ， 甚是 支持不住 ， 渐 感 走 力 。 再走 二十余 里 ， 韦小宝 挣扎着
@@ Epoch: 7  Output: 韦小宝和 双儿 胡说八道 起来 练剑 ， 捉 了一名 军士 。 众人 大急 ， 都 微感 诧异 。 双儿 回到 公主 寝 ， 一眼 不 弯 ， 一直 坐在地下 ， 给 按 摩
@@ Epoch: 8  Output: 韦小宝和 双儿 抢到 客店 ， 大叫 ： “ 是 故意 救你 家 吗 ？ ” 双儿 飞起 手 ， 格 开了 门闩 ， 将她 踢 了个筋斗 ， 喝道 ： “ 快 放手
@@ Epoch: 9  Output: 韦小宝和 双儿 又 见那 名 武士 身材魁梧 的大 姑娘 华贵 ， 女的 相貌 一模一样 ， 相貌 俊美 婀 娜 的 ， 容貌 丑陋 ， 形 色 真假 ， 一个 白 嫩 丽
@@ Epoch: 10 Output: 韦小宝和 双儿 展开轻功 ， 三人 挥 斧 ， 双剑 合 被 擒获 ， 三人 剑招 迅捷 ， 难以 伤 敌 ， 不料 三人 剑法 精奇 。 长乐帮 和 夏 胄 突然 斗得
@@ Epoch: 11 Output: 韦小宝和 双儿 瞧瞧 ， 得 在 中间 等你 冲出 大殿 跟随 。 张翠山 知她 只在 这 丁 离 波 浪 始终不 屈 ， 便不 露 齿 。 但他 身上 内力 未 加
```

**predict_every_epoch+no_shuffle**:
```shell
@@ Input: 神雕大侠
@@ Epoch: 0  Output: 神雕 大侠 总兵 出来 。 ） 更无 南 ” 康熙 ， 说道 ： “ 是 ， 韦 香主 ， 以后 有的 走了 。 ” 说着 不答 ， 在大 卫 亲自 多问 。
@@ Epoch: 1  Output: 神雕 大侠 ， 原 一死 ， 已经 了不少 独臂 文 的 正 君子 封 怒 ， 不可 快 擒 。 韦香主 不用 恨 ， 暗 访 。 其实 想去 尽 重大 特异
@@ Epoch: 2  Output: 神雕 大侠 的大 官 。 皇上吩咐 即 奏 浙 ， 在 扬州 府 台湾 无所 限 。 胜 军 、 挑 探 白马 ， 有 议 ， 有 弊 。 ” 见
@@ Epoch: 3  Output: 神雕 大侠 吗 ？ ” 他年纪 恭敬 理 ， 只是 “ 必须 有人 生气 ， 犯 折 不幸 可以 ， 以 撤 示 之女 。 其时 清廷 好 汉人 ， 推举 之
@@ Epoch: 4  Output: 神雕 大侠 十分 称赞 真假 ， 只想 他在 出 京 ， 他 向 十天 中 无人 进 府 府 喝酒 ， 这才 出 心 。 韦小宝在 赵 府 宏 化 特 ，
@@ Epoch: 5  Output: 神雕 大侠 的名字 。 出 汗 ， 死 了 。 ” 他不知 台湾 苏州 习 功 人 别说 有 君臣 ， 所 之 奏 折 分为 四 百余 倍 ， 自来 密
@@ Epoch: 6  Output: 神雕 大侠 无不 钦佩 。 何况 哪有 这样 兴致 目 ？ ” 龙 先生 虽 于 下了 言 ， 说得出 文 誉 、 规 定 中 开始 ， 更 有一 部 ，
@@ Epoch: 7  Output: 神雕 大侠 ， 可 太也 便宜 。 带 上门 吧 。 ” 待得 康熙 满脸 唔 ， 说道 ： “ 回 圣 天子 ， 可 跟他们 奏 折 ， 大是 妙 。
@@ Epoch: 8  Output: 神雕 大侠 ， 这才 不及 防 。 他 只要一 死心 塌 糊涂 ， 心想 ， 这 马 的人 之中 ， 总得 把 天下百姓 报 自 对 报信 ， 再 得 天地会 会众
@@ Epoch: 9  Output: 神雕 大侠 做官 ， 忠 字 ， 如 韦香主 天下第一 。 韦香主 ， 我 汉人 只一 着 不用 ， 天下 哪有 这么 ？ 这是 大大的 好人 吗 ？ ” 韦小宝笑道 ： “
@@ Epoch: 10 Output: 神雕 大侠 打 听到 ， 天下 人都 顺 天府 ， 喝 喜 酒 。 我这 件事 天天 重重 有 斟 ， 念着 你做 吴 府 知府 ， 这时 低声 隔 桌 的
@@ Epoch: 11 Output: 神雕 大侠 和 程 家 百姓 ， 带领 清兵 一 网 搬 运 河 ， 为 鞑 草 惊 蛇 。 众人 回 府 前往 。 韦小宝在 扬州 各处 街 市 借

@@ Input: 韦小宝和双儿
@@ Epoch: 0  Output: 韦小宝和 双儿 ， 一条 乡农 颇为 愤怒 ， 折 齐 ， 今日 连 斩 的 。 康熙 。 要救 你的 ， 卑职 挺 甚为 清楚 ， “ 大 亏 性命 ” ，
@@ Epoch: 1  Output: 韦小宝和 双儿 走一 觉 壮 视 ， 每 逢 国 者 治 奏 ， 决 修 的 奏 ， 连 二十 岁 ， 晚辈 可 很好 ， 反 在你 床 ， 却要
@@ Epoch: 2  Output: 韦小宝和 双儿 的 攻打 舱 门口 去见 十六年 ， 侧 船 所 处 ， 既 是一 间 府 汉 堂 和 夏 顺 犯 中国 的 典 折 ， 风 井 水
@@ Epoch: 3  Output: 韦小宝和 双儿 们 ： “ 韦香主 当真 再 知道我 去 察看 。 她 害死了 荷 兰 之力 ， 倒 不忙 追 毒 锦 去 ， 有 约 封 。 ” 韦小宝 叹了口气
@@ Epoch: 4  Output: 韦小宝和 双儿 这奸贼 为人 ， 全是 为了 这种 事 实 的 折磨 祸 ， 以致 母亲 全 忠 害 忌 的 ， 要 划 入 昆明 。 但 康熙 虽 亲信 和
@@ Epoch: 5  Output: 韦小宝和 双儿 一 溜 划 急 闯 。 韦小宝道 ： “ 
@@ Epoch: 6  Output: 韦小宝和 双儿 、 苏荃 、 冯 泰 等人 ， 但一 想到 要 奏 折 边 ， 今 之恨 。 愿 任 告 折 奏 折 奏 折 成 云 ： ‘ 眼
@@ Epoch: 7  Output: 韦小宝和 双儿 据 言 要 旁 非 之地 不可 。 倘 真 想 ， 一 进 我这 件 大大的 贪 污 ， 托 托 皇帝 再说 。 于是 皇帝 硬要 送 皇帝
@@ Epoch: 8  Output: 韦小宝和 双儿 去 抱 脚 的 毕生 垫 了 路 ， 这才 途中 疑 思 机 先 ， 去 立 康熙 进 关 。 康熙 当然 只 派 天地会 众兄弟 齐 来
@@ Epoch: 9  Output: 韦小宝和 双儿 一一 到来 该当如何 ？ 他 昨日 亲眼 得见 总管 韦香主 ， 哽 天下 汉人 人数 务 ， 天下 闻 闻 之事 ， 总算 韦香主 跟着 提心吊胆 。 那知 韦小宝 筹划
@@ Epoch: 10 Output: 韦小宝和 双儿 ， 和 众兄弟 混 奏 。 这倒 奇 谈 得很 。 ” 韦小宝 见韦小宝 唯 否 降 ， 拉着他 交给 沐剑屏 ， 说道 ： “ 胡闹 ！ ” 康熙道 ：
@@ Epoch: 11 Output: 韦小宝和 双儿 从 清 溪 里 取过 了一块 手帕 来 ， 生 长 吁 汤 ， 只是 许多 成 了个 “ 小 白龙 ” “ 两 呀 ” 二人 越墙 动静 。
```
这样对比下来，感觉shuffle打开效果更好，挨个子里拔将军，epoch9~10是最优秀的轮次。
所以总结来说，shuffle没有问题，有问题的是epoch太多，导致过拟合了。


