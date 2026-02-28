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

```shell
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

实现了temperature sampling之后，没有重复字了，但是模型智力应该完全没有提升，因为本质上只是吐下一个词的时候从贪心算法变成了概率采样算法，思考过程并没有任何变化。结果也显示推理效果确实毫无变化

```shell
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

缺少多头注意力是提升智能的关键，因为毕竟多个头可以关注不同的topic，单头只能关注一个。
所以完成上面的简单工作之后，我将单头注意力替换为了多头注意力。

最开始我的实现是，使用符合直觉的，但是可能会慢一些的方式，即用python list存放多个头，然后用for循环来进行多次矩阵运算。
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

实现过程中遇到一些困惑点。比如直觉上我认为(inputLen, dimEmb)的tensor，使用多头后应该是(numHead, inputLen, dimHead)的tensor，但是LLM告诉我应该`view(inputLen, numHead, dimHead).transpose(0, 1)`，我手动验证了一下才发现确实是这样的：
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
这样`view(inputLen, numHead, dimHead).transpose(0, 1)`之后，就得到了(numHead, inputLen, dimHead)的tensor。

使用多头注意力之后，推理的效果只能说基本也没变化，有点意外：
```shell
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
```

本来以为多头注意力是天神下凡，带来质变，结果量变都没有。

## Jinyong-specific tokenizer

虽然Tokenizer很重要，但是我没啥兴趣实现它，所以网上随便找了一份代码，使用huggingface/tokenizer来基于当前dataset训练了一个tokenizer。词表大小设置为20000，模型参数从75M爆降到46M，几乎缩小了一半，想了想缩小的部分应该就是tokenEmbedding和out，我理解前一个是查表，后一个是思考之后向量转回id，我估计模型智慧并不会降低，先这样吧。

但是这里我犯了个错误，网上随便找的分词器用的byte-level，导致最后乱码：

```python
tokenizer.pre_tokenizer = ByteLevel()
# @@ Input: 杨过和小龙女在
# @@ Output: Ġ æĿ¨è¿ĩåĴĮå°ıé¾Ļå¥³ åľ¨ èĴ²åĽ¢ ä¸ĭ éĤ£ åľŁ æĹĹ äºº ä¸´ ï¼ļ Ċ ãĢĢ ãĢĢ é¡¾çĤİæŃ¦ éģĵ ï¼ļâĢľ éŁ¦é¦Ļä¸» åĲ©åĴĲ ä¸Ń è¿Ļä¸Ģ å¥Ĺ æĪĳ è¿Ľ åĳĪ æĬļ ï¼Į è·ŁçĿĢ å¤§äºº ãĢĤâĢĿ Ċ ãĢĢ ãĢĢ
```

白忙活一场，只能重头再来，先训练tokenizer再训练模型。
这一次训练了10个epoch，loss 3.x，e^3.x≈20，说明smallgpt基本在20~30词左右犹豫并输出
中文分词优化后，推理效果如下：

```shell
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

➤**smallgpt推理效果提升巨大**，我的理解是smallgpt不再需要学习将6个byte当作一个token的能力（比如"杨过"是一个整体），天生获得了这个能力，它的参数可以关注其他更重要的语法和语义。这也许也可以解释为什么多头注意力没有达到预期的效果，因为模型大部分参数都用在理解认词了，它根本还没到多头注意力来捕捉深层语义（指代关系，情感倾向，人物关系等）的阶段。

## Dataset shuffle

我的数据集构建方式是把15本书拼成一个超大字符串，然后每513token作为一个chunk([0:512],target[1:513])，最终数据集是[chunk1,chunk2,...]
我给数据集加了`random.shuffle`，并且epoch调整到20，最终loss降低到了2.x的水平，但是推理结果好像反而更差了
```shell
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
...
@@ Epoch: 6  Output: 神雕 大侠 十九 向 无敌 鱼 禀报 ， 就 回 自己 幼时 去了 。 没说 啊 ！ 倘若我 真是 我的 意中人 ， 却又 会 加害
@@ Epoch: 7  Output: 神雕 大侠 ， 神雕 不耐烦了 ， 但 奇怪 的 几句话 竟 泄露 了 。 甄志丙 脸色 间 并不 甚 特异 ， 但此时 见他 眼望 杨过 ， 就此 一 目 ， 想要 争辩
@@ Epoch: 8  Output: 神雕 大侠 主 这一拳 无声无息 ， 很 怕你 。 黄蓉 此时 不论如何 原委 ， 惟 忠 知他 心意 ， 却 遭 此 横 棒 细 棒 刺中 他胸口 膻中穴 。 郭靖 此时
@@ Epoch: 9  Output: 神雕 大侠 给自己 。 无色 知他 虽 不是 杨过 ， 沉吟片刻 ， 脸色 一 白 ， 见 二道 倒 唇 相 看 ， 倒 跃出 鼻 管 。 杨过 身中 玉蜂针 ，
@@ Epoch: 10 Output: 神雕 大侠 细 密 ， 眼中 登时 粘 着一 块 岩石 出来 ， 飞 迅 雷 鸣 ， 通 体 落地 。 杨过 眼见 是 李莫愁 ， 要 设法 抢夺 小龙女 克制
@@ Epoch: 11 Output: 神雕 大侠 昂 首 ， 使 他日 常 带 阴 获 解 之人 而 少 ， 不禁 为之 狂 喜 。 一灯 却 指着 中间 的 脑海中 出神 ： “ 此人 年轻

@@ Input: 韦小宝和双儿
...
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
...
@@ Epoch: 6  Output: 神雕 大侠 无不 钦佩 。 何况 哪有 这样 兴致 目 ？ ” 龙 先生 虽 于 下了 言 ， 说得出 文 誉 、 规 定 中 开始 ， 更 有一 部 ，
@@ Epoch: 7  Output: 神雕 大侠 ， 可 太也 便宜 。 带 上门 吧 。 ” 待得 康熙 满脸 唔 ， 说道 ： “ 回 圣 天子 ， 可 跟他们 奏 折 ， 大是 妙 。
@@ Epoch: 8  Output: 神雕 大侠 ， 这才 不及 防 。 他 只要一 死心 塌 糊涂 ， 心想 ， 这 马 的人 之中 ， 总得 把 天下百姓 报 自 对 报信 ， 再 得 天地会 会众
@@ Epoch: 9  Output: 神雕 大侠 做官 ， 忠 字 ， 如 韦香主 天下第一 。 韦香主 ， 我 汉人 只一 着 不用 ， 天下 哪有 这么 ？ 这是 大大的 好人 吗 ？ ” 韦小宝笑道 ： “
@@ Epoch: 10 Output: 神雕 大侠 打 听到 ， 天下 人都 顺 天府 ， 喝 喜 酒 。 我这 件事 天天 重重 有 斟 ， 念着 你做 吴 府 知府 ， 这时 低声 隔 桌 的
@@ Epoch: 11 Output: 神雕 大侠 和 程 家 百姓 ， 带领 清兵 一 网 搬 运 河 ， 为 鞑 草 惊 蛇 。 众人 回 府 前往 。 韦小宝在 扬州 各处 街 市 借

@@ Input: 韦小宝和双儿
...
@@ Epoch: 6  Output: 韦小宝和 双儿 、 苏荃 、 冯 泰 等人 ， 但一 想到 要 奏 折 边 ， 今 之恨 。 愿 任 告 折 奏 折 奏 折 成 云 ： ‘ 眼
@@ Epoch: 7  Output: 韦小宝和 双儿 据 言 要 旁 非 之地 不可 。 倘 真 想 ， 一 进 我这 件 大大的 贪 污 ， 托 托 皇帝 再说 。 于是 皇帝 硬要 送 皇帝
@@ Epoch: 8  Output: 韦小宝和 双儿 去 抱 脚 的 毕生 垫 了 路 ， 这才 途中 疑 思 机 先 ， 去 立 康熙 进 关 。 康熙 当然 只 派 天地会 众兄弟 齐 来
@@ Epoch: 9  Output: 韦小宝和 双儿 一一 到来 该当如何 ？ 他 昨日 亲眼 得见 总管 韦香主 ， 哽 天下 汉人 人数 务 ， 天下 闻 闻 之事 ， 总算 韦香主 跟着 提心吊胆 。 那知 韦小宝 筹划
@@ Epoch: 10 Output: 韦小宝和 双儿 ， 和 众兄弟 混 奏 。 这倒 奇 谈 得很 。 ” 韦小宝 见韦小宝 唯 否 降 ， 拉着他 交给 沐剑屏 ， 说道 ： “ 胡闹 ！ ” 康熙道 ：
@@ Epoch: 11 Output: 韦小宝和 双儿 从 清 溪 里 取过 了一块 手帕 来 ， 生 长 吁 汤 ， 只是 许多 成 了个 “ 小 白龙 ” “ 两 呀 ” 二人 越墙 动静 。
```
这样对比下来，感觉shuffle打开效果更好，挨个子里拔将军，epoch9~10是最优秀的轮次。
所以总结来说，shuffle没有问题，有问题的是epoch太多，导致过拟合了。

## Batched training

继续优化。之前的实现每次训练（包括计算loss）都是使用一个样本，相当于模型每次的目标是学一句话，并且达到目标水平，现在batched dataset之后就是每次学batchSize=16句话。显然前者问题很多，包括但不限于梯度不稳，而且容易过拟合，坏处很多

batched dataset之后，还需要同步修改attention和loss的计算过程，因为之前attention接受的输入维度是`(inputLen,dimEmb)`，现在是`(batchSize, inputLen, dimEmb)`

```python
class Attention:
    ...
    def compute(self, x):
        # compute Q,K,V at once
        query = x @ self.wQuery
        key = x @ self.wKey
        value = x @ self.wValue
        # split the Q,K,V tensor into multiple heads, each head has dimHead
        # dimensions. Intuitively, I view old [batchSize, inputLen, dimEmb] as
        # [batchSize, numHead, inputLen, dimHead], but it turns out that it
        # should be firstly viewed as [batchSize, inputLen, numHead, dimHead] 
        # and transpose(1,2) dimensions to get the desired shape
        batchSize, inputLen, dimEmb = x.shape
        dimHead = dimEmb // self.numHead
        queries = query.view(batchSize, inputLen, self.numHead, dimHead).transpose(1, 2)
        keys = key.view(batchSize, inputLen, self.numHead, dimHead).transpose(1, 2)
        values = value.view(batchSize, inputLen, self.numHead, dimHead).transpose(1, 2)
        # compute Attention(Q,K,V) = softmax(mask(Q@K^T / sqrt(d_k))) @ V
        #
        # attention socre means which tokens are most relevant to current token
        #   Q(batchSize, numHead, inputLen, dimHead) @ K^T(batchSize, numHead, dimHead, inputLen)
        #   = attnScore(batchSize, numHead, inputLen, inputLen)
        attnScore = queries @ keys.transpose(-2, -1) / (dimHead**0.5)
        # use causal mask to prevent the current token from seeing future tokens
        #   attnScore(batchSize, numHead, inputLen, inputLen) @ mask(batchSize, numHead, inputLen, inputLen)
        #   = maskedAttnScore(batchSize, numHead, inputLen, inputLen)
        mask = torch.tril(torch.ones(inputLen, inputLen, device=x.device))
        attnScore = attnScore.masked_fill(mask == 0, -torch.inf)
        # apply softmax to get the attention weights
        attnWeights = torch.softmax(attnScore, dim=-1)
        # apply dropout to prevent overfitting
        attnWeights = self.dropout(attnWeights)
        # apply weights to the values to get the output
        #   attnWeights(batchSize, numHead, inputLen, inputLen) @ V(batchSize, numHead, inputLen, dimHead)
        #   = out(batchSize, numHead, inputLen, dimHead)
        out = attnWeights @ values
        # merge all attention heads back and apply final projection to understand how to 
        # combine the information from all heads
        #   out(batchSize, numHead, inputLen, dimHead)
        #   = out(batchSize, inputLen, dimEmb)
        out = out.transpose(1, 2).contiguous().view(batchSize, inputLen, dimEmb)
        return out @ self.wOut
```

10轮训练后，推理效果如下:

```shell
@@ Input: 杨过和小龙女在
@@ Output: 杨过和 小龙女 在 古墓中 出来 ， 见郭靖 将 短剑 轻轻 放 在他 颈中 ， 心中 已 感到 说不出的 欢喜 。 小龙 女 向杨过 呆呆出神 ， 道 ： “ 你师父 这般 畏惧 ， 你 是一
@@ Input: 神雕大侠
@@ Output: 神雕 大侠 一对 花 花 绘 成 ， 在 花 树下 旁的 花 枝 叶 之上 ， 虫 登时 浸 为 食 。 群豪 中 却 寂 中 。 又 饥 呼
@@ Input: 韦小宝和双儿
@@ Output: 韦小宝和 双儿 ， 见到了 鞋子 ， 已经 缩回 ， 却 再也 别无 他 ， 怒 得 急了 ， 骂道 ： “ 死 顽皮 ， 活  的 鬼 还没死 ， 老子 不 摔
@@ Input: 围攻光明顶
@@ Output: 围攻 光明顶 包 藏 出来 。 ” 洪七公 虽 浑 浑 然不 信 ， 但 五 味 药 店 听得 多了 ， 只得 省 起 一张 匙  羹 ， 舀 了一 匙
@@ Input: 郭靖和黄蓉
@@ Output: 郭靖 和 黄蓉 心中怦怦乱跳 ， 都 吃了一惊 。 梁子翁 知道 她 竟会 都 和自己 亲见 。 却见 身后 有个 少年  浑 不相同 ， 心中 惴惴 不安 ， 此人 并未 施展 ， 脚下 比
@@ Input: 张无忌
@@ Output: 张无忌 大奇 。 这一次 他 脸上 阴 沉沉的 变 黑色 布 ， 凭 手 按 摩 ， 大声说道 ： “ 那 番僧 炮 呢 ？ ”  他 越 叫 越 王
@@ Input: 令狐冲说
@@ Output: 令狐冲 说 便是 任教主 数次 ， 只是 高高 挂 单 身 东西 来 生气 ， 到头来 这才 失 信 上 疑 。 ” 令狐冲心 道 ： “ 是了 ， 叫做 ‘ 热 茶
@@ Input: 华山论剑
@@ Output: 华山论剑 ， 英雄好汉 ， 却 半点 力道 也不 大 得出 。 谢逊 双目 微微 睁 开 ， 倒 不忍 ， 但 适才 见他 双目 上 瞪视 ， 突然间 波 的一声 ，
@@ Input: 桃花岛上
@@ Output: 桃花岛上 呢 ？ 叫我 回到 迷 宫里 ， 好 在他 面前 打了个 吵 嘴 。 她 眼睛 嵌 好 ， 只 耳朵 蒙 在 牙齿 上 ， 却如 十几 只 白
@@ Input: 少林寺
@@ Output: 少林寺 之所 。 任我行 和 少林寺方丈 是我 神教 朋友 ， 你在 那 恒山 少林 武当 六大派 联络 嵩山 、 武当  两派 。 ” 方证道 ： “ 正是 ！ ” 左冷禅 冷笑道
@@ Input: 降龙十八掌
@@ Output: 降龙十八掌 的名字 完全 放 了出来 ， 手中 拿着一 小 丑 黄 布 ， 刻着 “ 圣火令 ” 四字 。 那 樵 是 武林至 尊 故 分为 蠕 而 作 ， 自来 潜心
```

**又一次smallgpt推理能力飞跃。**

比如这句话，都有点剧情的味道了，语法也基本正确：

> 杨过和 小龙女 {在 古墓中 出来 ， 见郭靖 将 短剑 轻轻 放 在他 颈中 ， 心中 已 感到 说不出的 欢喜 。 小龙 女 向杨过 呆呆出神 ， 道 ： “ 你师父 这般 畏惧...}

## SwiGLU based FFN

目前SmallGPT低垂的果实已经没多少了，多头、Batch、中文分词都搞完了，数据集我又不想新增，只能继续优化模型细节。

之前FFN是一个传统的GELU实现
```
    FFN(x) = GELU(x @ wUpProj) @ wDownProj
```
根据我的粗浅理解，相当于先升维（512->512*4），在高维空间寻找相似特征(比如"杨过","断了"),然后过激活函数决定开启/关闭某些特征,最终再降维（512*4->512）,根据激活的特征提取具体的知识(找到"断臂","郭芙")。

听说现在都流行SwiGLU,我又把FFN改造成了SwiGLU的形式：
``` 
    SwiGLU(x) = (SiLU(x @ wGate) * x @ wValue) @ wOut
```
SwiGLU是Google提出的一种改进的FFN结构，我理解是这样,两者都是先将上下文x升维(比如"杨过","断了"),只是说SwiGLU将x同时升维成两份,一份门控矩阵,一份内容矩阵,门控部分经过SiLU激活函数后成为一个0~1的系数矩阵,和内容矩阵逐元素相乘,相当于可以按照权重提取特征(之前FFN只能要么提取特征,要么不提取特征,现在可能是"杨过"100%激活,"断了"提取80%身体器官断,提取10%感情断),最后降维没啥区别,都是根据特征找到具体知识(找到"断臂","郭芙")

这个版本推理效果如下:

```shell
@@ Input: 杨过和小龙女在
@@ Output: 杨过和 小龙女 在 终南山 相距 甚远 。 杨过 走近身去 ， 又惊又喜 ， 说道 ： “ 姑姑 ，  你 逃 么 ？ ” 小龙女 哼了一声 ， 道 ： “ 这般 多礼 ， 你这小 娃儿
@@ Input: 神雕大侠
@@ Output: 神雕 大侠 这三人 ， 乘 人之 危 ， 只 袖手旁观 ， 只 这少年 发 挥 ， 自己也 一句 ， 竟 为 老毒物 所 激 ， 却 没法 分开 武功 比 喻 ，
@@ Input: 韦小宝和双儿
@@ Output: 韦小宝和 双儿 ！ ” 陈近南道 ： “ 都统大人 ， 请你 送 正 堂 执法 。 ” 当下 众弟子 齐声答应 。 尹 章 文 等三人 听 由 姚 春 道 命令 ， 但
@@ Input: 围攻光明顶
@@ Output: 围攻 光明顶 走一 郎 ， 路 道 这条 道 路 说 知 已到了 山 州 夷 山 之 境 ， 在 河南 城 外 的 地势 大为 减 。 路 派 那 宋
@@ Input: 郭靖和黄蓉
@@ Output: 郭靖 和 黄蓉 只因 练 内功 时 便已 迷 存 ， 遇到 一些 功夫 就 起始 学 学 ， 旁边 毫不 学 乍 能 压 少 ， 这才 有 用 计 收拾 ，
@@ Input: 张无忌
@@ Output: 张无忌 拿着 铁 片 ， 交给 鸠摩智 人的 侧 了几眼 ， 低头 看时 ， 却是个 拐杖 ， 忍不住 喝彩 。 他 这么一 笑 ， 说道 ： “ 我还道 我 有什么 古怪
@@ Input: 令狐冲说
@@ Output: 令狐冲 说 ： “ 你们 认 不 至 义 ， 还是 要 咱们 生气 ？ ” 只听 田伯光 又 伤心 ， 又  恼怒 ， 又 安慰 道 ： “ 那 第十 慈
@@ Input: 华山论剑
@@ Output: 华山论剑 ， 倘若 怕 害了 太后 ， 重重 一 掷 ， 那可 危险 。 太后 哈哈一笑 ， 微笑道  ： “ 毒 锦 命 本来 多了 ， 这里 是 奴才 的事 ，
@@ Input: 桃花岛上
@@ Output: 桃花岛上 ， 他心中 真假 皱 抚 育 ， 好 令 属下 教众 得知 。 各 派人 从后 山 、 挖掘  木 东 之人 ， 布 下 有 焦 地 要 南下
@@ Input: 少林寺
@@ Output: 少林寺 胡人 ， 是你 把我 放在心上 么 ？ ” 当日 下午 答应 恒山 随 母亲 ， 便从 少林寺 中 与 丁典 同时 找 遍了 ， 以防 侣 强弱 同行 ， 过 了一顿
@@ Input: 降龙十八掌
@@ Output: 降龙十八掌 之中 ， 岂能 毁 派的 弟子 了 ？ ” 郭 杨二人 和 宋远桥 、 莫声谷 都在 其内 。 张无忌道 ： “ 张真人 是 如何 ？ ” 宋远桥 等 微微 躬身
```

**smallgpt推理能力实质性提升**,除了三四句话外,其他的续写内容都比较通顺和流畅

这让我比较惊讶,但是细想之下,也不能说这种提升全是SwiGLU的功能,可能是这一系列优化的累计效应

## Alchemy: smaller vocabSize

之前的tokenizer的词汇表是20000词，现在重新训练tokenizer，调整到8000词:

```shell
@@ Input: 杨过和小龙女在
@@ Output: 杨过 和 小龙女 在 屋 前 ， 都 微 感 奇怪 ， 一时 将 二人 前 要 到 旷 中 调 使 水 法 “ 火 焰 刀 ” ， 古墓 中 寂 静
@@ Input: 神雕大侠
@@ Output: 神雕 大侠 无 情 。 襄阳 城中 到处 历 强 人 生 掣 城 以 来 迎 敌 ， 弃 富 贵 ， 甚为  累 ， 生 中 岂不是 一 世 血
@@ Input: 韦小宝和双儿
@@ Output: 韦小宝 和 双儿 分 较 ， 登时 便有 十余 名 蓝 锦 艇 四 层 ， 远远 站在 其 后 。 韦小宝 一怔 ， 低声道 ： “ 师太 慷 慨 ， 原来 这
@@ Input: 围攻光明顶
@@ Output: 围 攻 光明 顶 ， 更是 大 雾 积 雪 ， 国 武士 却不 来 攻 城 外 ， 那是 免 了 西 和 回 事 。 黄蓉 心中 反 想 ： “ 宋
@@ Input: 郭靖和黄蓉
@@ Output: 郭靖 和 黄蓉 说 自己 已 明白 了他 心 ， 她 虽 曾 言 辞 粮 ， 但 目光 中 充 满 腹 愁  ， 隐 藏 着 这 圹 隐 蔽 之际
```

调整到12000词：

```shell
@@ Input: 杨过和小龙女在
@@ Output: 杨过 和 小龙女 在 古墓 之中 突然 一 发 劲 ， 手中 一道 剑 竟 斩 之 坚 ， 公孙 衫 上 。 小龙女 凝 牙 舞 足 摔 在大 树 之下 ， 乘势
@@ Input: 神雕大侠
@@ Output: 神雕 大侠 ， 一条 长 索 。 他武功 既 避 开了 今日 ， 此 女 尼 嘴 剪 袭 ， 实 不 亚 绿竹 之下 ， “ 子弟 亏 你们 这些 高
@@ Input: 韦小宝和双儿
@@ Output: 韦小宝 和 双儿 、 阿珂 同 情 ， 跟随 着她 谈 到 她的 亏 少了 怒 ， 待 见他 一只 柔 腻 娇 柔 腻 的 ， 十几 颗 眼泪 也 钻 入了
@@ Input: 围攻光明顶
@@ Output: 围攻 光明顶 。 张召重 想 瞧他 如何 挡 ？ ” 张召重 道 ： “ 你 输了 ， 却 先 动手 ， 然后 再 想 一想 很好 ， 反 在你 身上 再 出
@@ Input: 郭靖和黄蓉
@@ Output: 郭靖 和 黄蓉 说笑 ， 只听得 楼 房中 的一 桌 ， 一 桌上 桌子 一 无所 有难 。 完颜洪烈 见 房中 挑 着一 碟 珠宝 荆 狗 鸡 独 门 ， 右手 比
```

相比于2000词，推理效果变差了，一次失败的炼丹。

## Weight tying

将tokenEmbeding和out的权重绑定在一起，减少模型参数量，加快loss收敛，实现非常简单

```python
self.tokenEmbedding = torch.nn.Embedding(self.tokenizer.vocabSize(), dimEmb)
self.out = torch.nn.Linear(dimEmb, self.tokenizer.vocabSize(), bias=False)
# tie the output projection with the token embedding to save memory
self.out.weight = self.tokenEmbedding.weight
```

这里比较迷惑人的是初看tokenEmbedding和out形状不一样，一个(vocabSize, dimEmb)，一个(dimEmb, vocabSize)，但是pytorch的Linear层的权重是(vocabSize, dimEmb)，在 `x @ Linear`会自动调用`x @ Linear.weight.T`，所以这里直接绑在一起是可以的。

推理效果就不测试了，这个应该不影响推理能力，主要是减少模型参数量

## TODO
- weight tying
- rmsnorm
- rope
- +windowsize，+layer
- cosine decay
- top-p