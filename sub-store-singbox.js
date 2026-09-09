let config = JSON.parse($files[0])

// 辅助函数：根据正则表达式筛选代理节点的 Tag
function getTags(proxies, regex) {
  if (!proxies || !Array.isArray(proxies)) return []
  if (!regex) return proxies.map(p => p.tag)
  return proxies.filter(p => regex.test(p.tag)).map(p => p.tag)
}

// 地区正则配置
const regions = [
  { name: '香港', regex: /港|hk|hongkong|hong kong|🇭🇰/i },
  { name: '台湾', regex: /台|tw|taiwan|🇹🇼/i },
  { name: '新加坡', regex: /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i },
  { name: '日本', regex: /日本|jp|japan|🇯🇵/i },
  { name: '美国', regex: /美|us|unitedstates|united states|🇺🇸/i },
]

// 1. 定义流量组合映射，并为不同组合指定对应的 domain_resolver Tag
const airportMap = [
  { name: '流量组合1-kzz', prefix: '机场1', isAI: false, resolverTag: 'dns-proxy-1' }, // 组合1 使用 dns-proxy-1
  { name: '流量组合2', prefix: '机场2', isAI: false, resolverTag: 'dns-proxy-2' }, // 组合2 使用 dns-proxy-2
  { name: '流量组合3', prefix: '机场2', isAI: false, resolverTag: 'dns-proxy-2' }, // 组合3 使用 dns-proxy-2
  { name: '流量组合4', prefix: '机场AI', isAI: true,  resolverTag: null },          // AI组合不注入
]

// 2. 依次拉取各个集合并处理
for (const airport of airportMap) {
  const proxies = await produceArtifact({
    name: airport.name,
    type: 'collection',
    platform: 'sing-box',
    produceType: 'internal',
  })

  // 核心逻辑：若配置了 resolverTag，为当前组合的所有节点注入对应的 domain_resolver 字段
  if (airport.resolverTag) {
    proxies.forEach(proxy => {
      proxy.domain_resolver = airport.resolverTag
    })
  }

  // 如果不是 AI 组合，才追加节点详细信息到总 outbounds
  if (!airport.isAI) {
    config.outbounds.push(...proxies)
  }

  // 获取当前集合所有节点的 Tag
  const allTags = getTags(proxies)

  // A. 填充到“自动”和“手动”分组
  const autoTag = `${airport.prefix}-自动`
  const manualTag = `${airport.prefix}-手动`

  config.outbounds.forEach(outbound => {
    if ([autoTag, manualTag].includes(outbound.tag)) {
      outbound.outbounds.push(...allTags)
    }
  })

  // B. 填充到各个地区分组
  regions.forEach(region => {
    const targetTag = `${airport.prefix}-${region.name}`
    const matchedTags = getTags(proxies, region.regex)

    config.outbounds.forEach(outbound => {
      if (outbound.tag === targetTag) {
        outbound.outbounds.push(...matchedTags)
      }
    })
  })
}

// 3. 空分组保底机制（防止某分组或某地区无节点导致 sing-box 启动报错）
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
