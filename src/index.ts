import { Context, Schema, h } from 'koishi'
import { } from 'koishi-plugin-puppeteer'
import { resolve } from 'path'
import { promises as fs } from 'fs'

export const name = 'menu-plugin'

export interface Config {
  backgroundImage: string
  title: string
  description: string
  usePuppeteer: boolean
  closeBrowserAfterUse: boolean
  screenshotMode: 'auto' | 'manual'
  viewportWidth: number
  viewportHeight: number
  quality: number
  delay: number
  commandsPerRow: number
  adminUsers: string[]
  dataFile: string
}

export const Config: Schema<Config> = Schema.object({
  backgroundImage: Schema.string().default('background.jpg').description('背景图片路径'),
  title: Schema.string().default('机器人功能菜单').description('菜单标题'),
  description: Schema.string().default('以下是本机器人的全部可用功能').description('菜单描述'),
  usePuppeteer: Schema.boolean().default(true).description('是否使用Puppeteer生成图片菜单'),
  closeBrowserAfterUse: Schema.boolean().default(false).description('每次使用后关闭浏览器（节省资源但速度较慢）'),
  screenshotMode: Schema.union([
    Schema.const('auto').description('自动根据内容高度截图'),
    Schema.const('manual').description('手动指定截图大小'),
  ]).default('auto').description('截图模式'),
  viewportWidth: Schema.number().default(1000).description('截图宽度（手动模式）'),
  viewportHeight: Schema.number().default(800).description('截图高度（手动模式）'),
  quality: Schema.number().default(90).min(10).max(100).description('图片质量（1-100）'),
  delay: Schema.number().default(1000).description('页面加载延迟时间（毫秒）'),
  commandsPerRow: Schema.number().default(5).min(2).max(8).description('每行显示的指令数量'),
  adminUsers: Schema.array(String).role('table').description('管理员用户ID列表').default([]),
  dataFile: Schema.string().default('data/menu-commands.json').description('指令数据存储文件路径'),
})

export interface CommandInfo {
  category: string
  commands: Array<{
    name: string
    description: string
    example?: string
  }>
}

export const inject = {
  required: ['puppeteer']
}

export function apply(ctx: Context, config: Config) {
  const hasPuppeteer = ctx.puppeteer && config.usePuppeteer
  let commandsDB: CommandInfo[] = []

  if (config.usePuppeteer && !ctx.puppeteer) {
    ctx.logger.warn('Puppeteer服务不可用，将使用文本菜单模式')
  }

  // 权限检查函数
  function checkPermission(session: any): boolean {
    if (!session?.userId) return false
    return config.adminUsers.includes(session.userId)
  }

  // 加载指令数据
  async function loadCommands() {
    try {
      const dataPath = resolve(ctx.baseDir, config.dataFile)
      const data = await fs.readFile(dataPath, 'utf-8')
      commandsDB = JSON.parse(data)
      ctx.logger.info('指令数据加载成功')
    } catch (error) {
      ctx.logger.warn('无法加载指令数据文件，使用默认数据')
      // 使用默认数据
      commandsDB = [
        {
          category: '连飞功能',
          commands: [
            { name: '随机国内', description: '抽取起飞机场' },
            { name: '随机国内 ZGGG', description: '抽取起飞机场，落地机场固定为ZGGG' },
            { name: '随机国内 ZGGG 600', description: '抽取落地机场，起飞机场固定为ZGGG，两机场之间直线距离在600海里以内' },
            { name: '刷新落地缓存', description: '刷新落地缓存，用于修复一些问题' },
            { name: '刷新机场缓存', description: '刷新起飞缓存，用于修复一些问题' },
            { name: '随机落地 ZGGG', description: '固定落地机场为ZGGG，抽取起飞机场' },
            { name: '随机落地 ZGGG 600', description: '固定落地机场为ZGGG，抽取起飞机场，两机场之间直线距离在600海里以内' },
            { name: '随机等级 4F', description: '固定起飞机场并随机选落地机场（现有4C,4D,4E,4F,3C,3D可选）' },
            { name: 'metar/气象 icao', description: '查询机场metar报文' },
            { name: '查看关键词列表', description: '查看可用关键词列表' },
            { name: 'volanta {CALLSIGN}', description: '查询VOLANTA机组位置+状态' },
            { name: '航图 或 eaip', description: '查询eaip机场航图（目前仅可查询国内公开机场）' },
            { name: 'atis', description: '查询机场的通波，支持部分NAIP机场' },
            { name: '航路', description: '查询两机场之间的航路' },
            { name: '飞机图片', description: '查询现实中某架飞机的图片 如 B-2447' }
          ]
        },
        {
          category: '专属功能',
          commands: [
            { name: 'asn在线', description: '查询ASN平台在线人数' },
            { name: '订阅查询', description: '查询订阅信息' },
            { name: '订阅添加', description: '添加新的订阅' },
            { name: '推文列表', description: '查看推文列表' },
            { name: '全局添加', description: '全局添加功能' }
          ]
        },
        {
          category: '欧卡功能',
          commands: [
            { name: '绑定 [TMP编号]', description: '绑定TMP账号' },
            { name: '查询 [TMP编号]', description: '查询TMP信息' },
            { name: '定位 [TMP编号]', description: '定位TMP位置' },
            { name: '路况 [s1/s2/p/a]', description: '查询路况信息' },
            { name: '今日里程排行榜', description: '查看今日里程排名' },
            { name: '总里程排行表', description: '查看总里程排名' },
            { name: '欧卡DLC', description: '查看欧卡DLC信息' },
            { name: '欧卡服务器', description: '查看欧卡服务器状态' },
            { name: '美卡服务器', description: '查看美卡服务器状态' },
            { name: '游戏版本', description: '查看游戏版本信息' }
          ]
        },
        {
          category: '娱乐功能',
          commands: [
            { name: '支付宝到账', description: '模拟支付宝到账语音' },
            { name: '本群关机', description: '关闭本群回复' },
            { name: '点歌', description: '点播音乐' },
            { name: '哔哩哔哩视频解析', description: '解析B站视频信息' },
            { name: '今天星期四', description: '星期四特别功能' },
            { name: '泡面3分钟', description: '3分钟后提醒吃泡面' },
            { name: 'zanwo/zan', description: '给自己QQ空间点赞' },
            { name: '签到', description: '每日签到（坚持打卡有惊喜）' },
            { name: 'aircon', description: '群空调' },
            { name: '喜报', description: '输出喜报图片' },
            { name: '悲报', description: '输出悲报图片' },
            { name: 'rua', description: 'rua你的头像' },
            { name: '敲', description: '敲打功能' },
            { name: '砖头', description: '砖头功能' }
          ]
        }
      ]
      // 保存默认数据
      await saveCommands()
    }
  }

  // 保存指令数据
  async function saveCommands() {
    try {
      const dataPath = resolve(ctx.baseDir, config.dataFile)
      const dirPath = resolve(ctx.baseDir, 'data')
      
      // 确保目录存在
      try {
        await fs.access(dirPath)
      } catch {
        await fs.mkdir(dirPath, { recursive: true })
      }
      
      await fs.writeFile(dataPath, JSON.stringify(commandsDB, null, 2), 'utf-8')
      ctx.logger.info('指令数据保存成功')
    } catch (error) {
      ctx.logger.error('保存指令数据失败:', error)
    }
  }

  // 初始化加载数据
  loadCommands()

  // 创建页面函数
  async function createPage() {
    try {
      const page = await ctx.puppeteer.page()
      return page
    } catch (error) {
      ctx.logger.error('创建puppeteer页面失败:', error)
      return null
    }
  }

  // 主菜单命令
  ctx.command('菜单', '显示机器人功能菜单')
    .alias('主单')
    .alias('功能')
    .action(async ({ session }) => {
      try {
        if (!hasPuppeteer) {
          return generateTextMenu(commandsDB, config)
        }

        const page = await createPage()
        if (!page) {
          return generateTextMenu(commandsDB, config)
        }

        const html = generateMenuHTML(commandsDB, config)
        
        if (config.screenshotMode === 'auto') {
          await page.setViewport({ width: 1000, height: 100 })
          await page.setContent(html)
          await new Promise(resolve => setTimeout(resolve, config.delay))
          
          const bodyHeight = await page.evaluate(() => {
            return document.body.scrollHeight
          })
          
          await page.setViewport({ 
            width: 1000, 
            height: Math.min(bodyHeight + 100, 10000)
          })
        } else {
          await page.setViewport({ 
            width: config.viewportWidth, 
            height: config.viewportHeight 
          })
          await page.setContent(html)
          await new Promise(resolve => setTimeout(resolve, config.delay))
        }
        
        const screenshot = await page.screenshot({
          type: 'jpeg',
          quality: config.quality
        })
        
        await page.close()
        
        return h.image(screenshot, 'image/jpeg')
        
      } catch (error) {
        ctx.logger.error('生成菜单失败:', error)
        return generateTextMenu(commandsDB, config)
      }
    })

  // 状态查看命令
  ctx.command('菜单状态', '查看菜单插件状态')
    .action(({ session }) => {
      const status = {
        puppeteer可用: hasPuppeteer ? '是' : '否',
        截图模式: config.screenshotMode,
        视口大小: `${config.viewportWidth}x${config.viewportHeight}`,
        图片质量: `${config.quality}%`,
        加载延迟: `${config.delay}ms`,
        每行指令数: config.commandsPerRow,
        数据文件: config.dataFile,
        管理员数量: config.adminUsers.length
      }
      
      return `菜单插件状态：\n${Object.entries(status).map(([key, value]) => `• ${key}: ${value}`).join('\n')}`
    })

  // 添加指令命令 - 需要权限
  ctx.command('添加指令 <category:string> <name:string> <description:string>', '添加新的指令介绍')
    .action(async ({ session }, category, name, description) => {
      if (!checkPermission(session)) {
        return '您没有权限执行此操作'
      }
      
      let categoryObj = commandsDB.find(c => c.category === category)
      if (!categoryObj) {
        categoryObj = { category, commands: [] }
        commandsDB.push(categoryObj)
      }
      
      categoryObj.commands.push({ name, description })
      await saveCommands()
      return `指令 "${name}" 已添加到 "${category}" 分类`
    })

  // 删除指令命令 - 需要权限
  ctx.command('删除指令 <category:string> <name:string>', '删除指令介绍')
    .action(async ({ session }, category, name) => {
      if (!checkPermission(session)) {
        return '您没有权限执行此操作'
      }
      
      const categoryObj = commandsDB.find(c => c.category === category)
      if (!categoryObj) return `分类 "${category}" 不存在`
      
      const index = categoryObj.commands.findIndex(cmd => cmd.name === name)
      if (index === -1) return `指令 "${name}" 在分类 "${category}" 中不存在`
      
      categoryObj.commands.splice(index, 1)
      await saveCommands()
      return `指令 "${name}" 已从 "${category}" 分类中删除`
    })

  // 删除分类命令 - 需要权限
  ctx.command('删除分类 <category:string>', '删除整个分类及其所有指令')
    .action(async ({ session }, category) => {
      if (!checkPermission(session)) {
        return '您没有权限执行此操作'
      }
      
      const index = commandsDB.findIndex(c => c.category === category)
      if (index === -1) return `分类 "${category}" 不存在`
      
      const categoryInfo = commandsDB[index]
      const commandCount = categoryInfo.commands.length
      
      commandsDB.splice(index, 1)
      await saveCommands()
      return `已删除分类 "${category}"，包含 ${commandCount} 个指令`
    })

  // 添加分类命令 - 需要权限
  ctx.command('添加分类 <category:string>', '添加新的分类')
    .action(async ({ session }, category) => {
      if (!checkPermission(session)) {
        return '您没有权限执行此操作'
      }
      
      if (commandsDB.find(c => c.category === category)) {
        return `分类 "${category}" 已存在`
      }
      
      commandsDB.push({ category, commands: [] })
      await saveCommands()
      return `已添加新分类 "${category}"`
    })

  // 查看分类命令
  ctx.command('查看指令分类', '查看所有指令分类')
    .action(() => {
      let result = '📁 所有指令分类：\n\n'
      commandsDB.forEach((category, index) => {
        result += `${index + 1}. ${category.category} (${category.commands.length} 个指令)\n`
      })
      result += `\n💡 使用"删除分类 <分类名>"可以删除整个分类`
      return result
    })

  // 重载数据命令 - 需要权限
  ctx.command('重载菜单数据', '重新加载菜单数据')
    .action(async ({ session }) => {
      if (!checkPermission(session)) {
        return '您没有权限执行此操作'
      }
      
      await loadCommands()
      return `菜单数据已重载，共加载 ${commandsDB.length} 个分类`
    })

  // 查看管理员命令 - 需要权限
  ctx.command('查看菜单管理员', '查看菜单插件管理员列表')
    .action(({ session }) => {
      if (!checkPermission(session)) {
        return '您没有权限执行此操作'
      }
      
      if (config.adminUsers.length === 0) {
        return '当前没有设置管理员'
      }
      
      return `菜单插件管理员：\n${config.adminUsers.map((user, index) => `${index + 1}. ${user}`).join('\n')}`
    })
}

// HTML生成函数保持不变
function generateMenuHTML(commands: CommandInfo[], config: Config): string {
  const commandsPerRow = config.commandsPerRow || 5;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Noto Sans SC', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            min-height: 100vh;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 30px;
            max-width: 1200px;
            margin: 0 auto;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        
        .title {
            font-size: 2.2em;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        
        .description {
            font-size: 1.1em;
            color: #7f8c8d;
            font-weight: 400;
        }
        
        .category {
            margin-bottom: 30px;
        }
        
        .category-title {
            font-size: 1.5em;
            font-weight: 600;
            color: #3498db;
            margin-bottom: 20px;
            padding: 10px 20px;
            background: linear-gradient(135deg, #3498db15, #2980b915);
            border-radius: 10px;
            border-left: 5px solid #3498db;
            text-align: center;
        }
        
        .command-grid {
            display: grid;
            grid-template-columns: repeat(${commandsPerRow}, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .command-item {
            background: white;
            padding: 15px;
            border-radius: 10px;
            border: 1px solid #e0e0e0;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            text-align: center;
            min-height: 120px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .command-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.1);
            border-color: #3498db;
        }
        
        .command-name {
            font-weight: 600;
            color: #2c3e50;
            font-size: 1em;
            margin-bottom: 8px;
            line-height: 1.3;
        }
        
        .command-desc {
            color: #5d6d7e;
            font-size: 0.85em;
            line-height: 1.4;
        }
        
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #95a5a6;
            font-size: 0.9em;
        }
        
        /* 响应式设计 */
        @media (max-width: 1000px) {
            .command-grid {
                grid-template-columns: repeat(4, 1fr);
            }
        }
        
        @media (max-width: 800px) {
            .command-grid {
                grid-template-columns: repeat(3, 1fr);
            }
            
            .container {
                padding: 20px 15px;
                margin: 10px;
            }
            
            .title {
                font-size: 1.8em;
            }
        }
        
        @media (max-width: 600px) {
            .command-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .category-title {
                font-size: 1.3em;
            }
        }
        
        @media (max-width: 400px) {
            .command-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${config.title}</h1>
            <p class="description">${config.description}</p>
        </div>
        
        ${commands.map(category => `
            <div class="category">
                <h2 class="category-title">${category.category}</h2>
                <div class="command-grid">
                    ${category.commands.map(command => `
                        <div class="command-item">
                            <div class="command-name">${command.name}</div>
                            <div class="command-desc">${command.description}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
        
        <div class="footer">
            <p>输入具体指令名称即可使用对应功能</p>
            <p>更多功能持续开发中...</p>
        </div>
    </div>
</body>
</html>
  `
}

// 文本菜单生成函数
function generateTextMenu(commands: CommandInfo[], config: Config): string {
  const commandsPerRow = config.commandsPerRow || 5;
  
  let text = `📋 ${config.title}\n`
  text += `${config.description}\n\n`
  
  commands.forEach(category => {
    text += `🎯 ${category.category}\n`
    text += '─'.repeat(30) + '\n'
    
    // 将指令分组，每行显示commandsPerRow个
    for (let i = 0; i < category.commands.length; i += commandsPerRow) {
      const rowCommands = category.commands.slice(i, i + commandsPerRow);
      const rowText = rowCommands.map(cmd => {
        // 限制每个指令显示长度，确保对齐
        const name = cmd.name.length > 10 ? cmd.name.substring(0, 10) + '...' : cmd.name.padEnd(13, ' ');
        return `${name}`;
      }).join('  ');
      
      text += `${rowText}\n`;
    }
    
    text += '\n'
  })
  
  text += '💡 提示：输入具体指令名称即可使用对应功能\n'
  text += '🚀 更多功能持续开发中...'
  
  return text
}