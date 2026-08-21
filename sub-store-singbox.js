let config = JSON.parse($files[0])

// 1. 定义 4 个机场集合与目标出站 Group 的映射关系
const airportMap = [
  { name: '流量组合1', autoTag: '机场1-自动', manualTag: '机场1-手动', isAI: false },
  { name: '流量组合2', autoTag: '机场2-自动', manualTag: '机场2-手动', isAI: false },
  { name: '流量组合3', autoTag: '机场3-自动', manualTag: '机场3-手动', isAI: false },
  { name: '流量组合4', autoTag: '机场AI-自动', manualTag: '机场AI-手动', isAI: true  },
]

// 2. 依次异步拉取各个集合
for (const airport of airportMap) {
  const proxies = await produceArtifact({
    name: airport.name,
    type: 'collection',
    platform: 'sing-box',
    produceType: 'internal',
  })

  // 重点：如果不是 AI 组合（即 1、2、3），才追加节点详细信息到总 outbounds
  // AI 组合（组合4）的节点在前面已经存在，所以跳过 push 节点本身
  if (!airport.isAI) {
    config.outbounds.push(...proxies)
  }

  // 提取当前集合所有节点的 Tag
  const tags = proxies.map(p => p.tag)

  // 依然正常把 Tag 写入对应的 自动组 和 手动组
  config.outbounds.forEach(outbound => {
    if ([airport.autoTag, airport.manualTag].includes(outbound.tag)) {
      outbound.outbounds.push(...tags)
    }
  })
}

// 3. 空分组保底机制（防止某集合为空导致 sing-box 启动失败）
let compatible = false
const compatible_outbound = { tag: 'COMPATIBLE', type: 'direct' }

config.outbounds.forEach(outbound => {
  if (Array.isArray(outbound.outbounds) && outbound.outbounds.length === 0) {
    if (!compatible) {
      config.outbounds.push(compatible_outbound)
      compatible = true
    }
    outbound.outbounds.push(compatible_outbound.tag)
  }
})

$content = JSON.stringify(config, null, 2)
