import { BOARD_AIM_Y, BOARD_BOTTOM, BOARD_LEFT, BOARD_RIGHT, BOARD_TOP } from '../modes/arena.ts'
import type { Arena, Target } from '../modes/arena.ts'
import type { Camera, Vec3 } from './camera.ts'

type Face = { points: Vec3[]; color: string }
type Panel = { at: Vec3; text: string; height: number; color: string }
type ScreenPoint = { x: number; y: number; depth: number }
const terrain: Face[] = []
const floor: Face[] = []
const structures: Face[] = []
const panels: Panel[] = []
const p = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const oxide = '#b95738'
const orange = '#ff8150'
const teal = '#62cfcc'
const armorTint = (armor: number) => armor >= 125 ? '#f17b63' : armor >= 100 ? '#b793ff' : armor >= 75 ? '#77acfa' : '#becdd7'

function front(x1: number, y1: number, x2: number, y2: number, z: number): Vec3[] {
  return [p(x1, y1, z), p(x2, y1, z), p(x2, y2, z), p(x1, y2, z)]
}

function ground(x1: number, z1: number, x2: number, z2: number, y = 0): Vec3[] {
  return [p(x1, y, z1), p(x2, y, z1), p(x2, y, z2), p(x1, y, z2)]
}

function cube(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, colors: [string, string, string]): void {
  const [face, side, top] = colors
  structures.push(
    { points: ground(x1,z1,x2,z2,y1), color: '#242a30' },
    { points: ground(x1,z1,x2,z2,y2), color: top },
    { points: [p(x1,y1,z1), p(x1,y1,z2), p(x1,y2,z2), p(x1,y2,z1)], color: side },
    { points: [p(x2,y1,z1), p(x2,y1,z2), p(x2,y2,z2), p(x2,y2,z1)], color: '#343a43' },
    { points: front(x1,y1,x2,y2,z2), color: side },
    { points: front(x1,y1,x2,y2,z1), color: face },
  )
}

function detail(x1: number, y1: number, x2: number, y2: number, z: number, color: string): void {
  structures.push({ points: front(x1,y1,x2,y2,z), color })
}

function ridge(z: number, vertices: [number, number][], color: string): void {
  const first = vertices[0][0]
  const last = vertices[vertices.length - 1][0]
  terrain.push({ points: [p(first,-1,z), ...vertices.map(([x,y]) => p(x,y,z)), p(last,-1,z)], color })
}

ridge(230, [[-290,31],[-235,54],[-191,48],[-160,36],[-113,34],[-72,51],[-28,27],[27,33],[62,49],[93,44],[129,63],[193,41],[290,47]], '#574a49')
ridge(186, [[-268,44],[-200,38],[-172,67],[-151,68],[-123,48],[-84,52],[-62,31],[-38,28],[-20,32],[19,25],[52,32],[70,48],[92,50],[117,34],[166,58],[220,62],[268,43]], '#423d43')
ridge(149, [[-225,61],[-165,57],[-135,55],[-114,46],[-98,47],[-87,43],[-72,35],[-56,36],[-39,19],[-23,16],[18,18],[27,24],[41,32],[64,35],[82,50],[111,47],[137,57],[182,52],[225,61]], '#302f39')
terrain.push(
  { points: [p(-115,46,148),p(-98,47,149),p(-87,43,149),p(-72,35,149),p(-52,2,154),p(-91,9,151)], color:'#403940' },
  { points: [p(39,0,148),p(64,35,149),p(82,50,149),p(111,47,149),p(89,24,151),p(73,5,152)], color:'#3b3440' },
  { points: [p(142,0,148),p(137,57,149),p(158,53,149),p(181,34,153),p(173,4,154)], color:'#38323a' },
)

const slate: [string, string, string] = ['#303842','#202831','#47505c']
const steel: [string, string, string] = ['#41464d','#282e37','#56606b']
const rust: [string, string, string] = ['#683f36','#4c3331','#865240']
const dark: [string, string, string] = ['#1d252e','#192029','#39434f']

function gate(z: number, x: number, h: number): void {
  for (const side of [-1, 1]) {
    const center = side*x
    cube(center-.88,0,z-.1,center+.88,.43,z+2,steel)
    cube(center-.57,.43,z+.22,center+.57,h,z+1.8,slate)
    cube(center-.36,.52,z-.01,center+.36,h-.7,z+.23,dark)
    detail(center-.5,h-1,center+.5,h-.72,z-.04,oxide)
    detail(center-.16,1.56,center+.16,2.58,z-.035,'#1b272d')
    detail(center-.11,1.72,center+.11,2.43,z-.04,teal)
    detail(center-.51,.57,center-.42,1.6,z+.2,'#b66a44')
  }
  cube(-x-.9,h-.45,z,x+.9,h+.45,z+2.08,steel)
  cube(-x-.18,h+.46,z+.2,x+.18,h+.63,z+1.58,dark)
  detail(-x,h+.05,x,h+.12,z-.035,'#62666b')
  detail(-x+.26,h-.38,x-.26,h-.32,z-.035,oxide)
  detail(-1.63,h-.28,1.63,h+.13,z-.05,'#23262a')
  detail(-1.43,h-.20,1.43,h+.06,z-.055,'#805140')
  for (const xInset of [-x+.9,-x+1.5,x-1.5,x-.9]) detail(xInset-.16,h-.3,xInset+.16,h+.17,z-.05,'#bb6d48')
  panels.push({ at:p(0,h-.06,z-.06), text:z<29?'RANGE  /  01':z<60?'MID RANGE':'DOWNRANGE', height:.23, color:'#ecd4b5' })
}

cube(-32,0,132,32,4.5,134,slate)
for (let x=-25; x<=25; x+=5) {
  cube(x-.07,0,131.93,x+.07,4.6,132.1,steel)
  detail(x+.4,3.4,x+3.8,3.55,131.9,'#734f42')
}
gate(98,6.4,6)
gate(54,7.7,6.2)
gate(24,9,5.8)

for (const side of [-1,1]) {
  for (const z of [91,71,36,12]) {
    const cx=side*(z>20?15.65:13.85)
    const end = z + (z===12 ? 13 : 12)
    cube(cx-3.15,0,z+.64,cx+3.15,.42,end,steel)
    cube(cx-2.76,.42,z+1.2,cx+2.76,3.18,end-.35,slate)
    cube(cx-2.61,3.18,z+1.47,cx+2.61,3.75,end-.54,dark)
    cube(cx-3.01,.46,z+.54,cx+3.01,1.2,z+1.29,rust)
    detail(cx-2.46,1.32,cx+2.46,2.87,z+1.16,'#20272e')
    detail(cx-2.24,1.53,cx+.92,2.66,z+1.12,'#323942')
    detail(cx+1.14,1.58,cx+2.15,2.67,z+1.12,'#161f27')
    detail(cx+1.31,1.83,cx+1.97,1.89,z+1.09,teal)
    detail(cx+1.31,2.03,cx+1.97,2.08,z+1.09,'#41817f')
    detail(cx-2.5,2.93,cx+2.5,3.04,z+1.1,'#9e664f')
    detail(cx-2.64,.62,cx+2.64,.69,z+.51,'#c67a51')
    if (z===12) {
      cube(cx-1.72,3.75,z+2.32,cx+1.72,5.23,end-1,steel)
      cube(cx-1.81,5.22,z+2.18,cx+1.82,5.48,end-.88,rust)
      detail(cx-1.57,4,cx+1.57,4.87,z+2.27,'#1c2730')
      detail(cx-1.53,4.01,cx+1.53,4.08,z+2.25,'#b95d3b')
      for (let x=-1.4; x<1.4; x+=.21) detail(cx+x,4.2,cx+x+.054,4.68,z+2.24,'#424852')
      const ax = cx + side*.84
      cube(ax-.045,5.46,z+3.8,ax+.045,7.81,z+3.89,steel)
      cube(ax-.56,6.81,z+3.8,ax+.56,6.9,z+3.9,dark)
      cube(ax-.08,7.79,z+3.77,ax+.08,7.91,z+3.91,['#e97650','#b5503a','#f4b291'])
      panels.push({ at:p(cx-.66,2.1,z+1.08), text:side<0?'SECTOR A':'SECTOR B', height:.36, color:'#b1afa8' })
    }
  }
  for (const z of [9,19,34,47,62,75,91,111]) {
    const x=side*(z<24?8.9:9.35)
    cube(x-.69,0,z-.4,x+.69,.22,z+.82,steel)
    cube(x-.34,.2,z-.15,x+.34,.94,z+.5,dark)
    detail(x-.27,.66,x+.27,.87,z-.18,'#8b5541')
    detail(x-.16,.73,x+.16,.81,z-.19,teal)
  }
  for (const z of [113,94,71,46,31]) {
    const x=side*(22+(z%8))
    const h=2.6+(z%6)*.9
    const baseL=p(x-5.7,0,z-2.1), baseR=p(x+7.5,0,z-3)
    const topL=p(x-2.4,h*.8,z+1.3), topR=p(x+1.8,h,z+3.1)
    const seam=p(x+.5,h*.32,z-2.6)
    structures.push(
      { points:[baseL,topL,topR,seam], color:'#52433e' },
      { points:[baseL,seam,baseR], color:'#3f3736' },
      { points:[topR,p(x+5.2,h*.71,z+1.2),baseR,seam], color:'#474044' },
    )
  }
}

const tileColors = ['#33383d','#373b40','#3c3e41','#3d3e41','#34393f','#3a3c41']
const lanes = [-44,-28,-19,-12,-8,-4,0,4,8,12,19,28,44]
for (let z=124; z>=-26; z-=5) {
  for (let i=0;i<lanes.length-1;i++) {
    const paletteIndex = (i * 11 + z * 3 + 90) % tileColors.length
    const color = (i===5||i===6) && z<35 ? '#30363b' : tileColors[paletteIndex]
    floor.push({ points:ground(lanes[i]+.024,z+.032,lanes[i+1]-.024,z+4.97,.002), color })
  }
}
for (const side of [-1,1]) {
  const strip=(x1:number,z1:number,x2:number,z2:number,color:string)=>floor.push({points:ground(Math.min(x1*side,x2*side),z1,Math.max(x1*side,x2*side),z2,.013),color})
  strip(4.18,-26,4.25,129,'#a07a58')
  strip(4.52,-26,4.55,129,'#555558')
  strip(8.18,-26,8.59,129,'#20272d')
  strip(8.23,-26,8.27,129,'#667171')
  for(let z=-24;z<125;z+=5) {
    strip(4.26,z,4.50,z+.23,oxide)
    strip(6,z+1.2,6.085,z+3.3,'#7e7770')
    strip(8.31,z+.4,8.50,z+1.15,'#449796')
  }
  for (const z of [-1,4,10,20,30,45,60,90,120]) {
    strip(1.1,z,2.95,z+.10,'#686666')
    strip(2.83,z+.11,2.95,z+.37,'#686666')
  }
  for (let i=0;i<23;i++) {
    const z=-12+(i*3947%242)/7
    const x=4.9+(i*247%72)/16
    strip(x,z,x+.35+(i%4)*.07,z+.025,i%2?'#525254':'#282e33')
  }
}

structures.sort((a,b) => {
  const depth = (mesh: Face) => mesh.points.reduce((sum,point)=>sum+point.z,0) / mesh.points.length
  return depth(b)-depth(a)
})

function polygon(ctx: CanvasRenderingContext2D, camera: Camera, points: Vec3[], color: string | CanvasGradient): void {
  let projected = points.map(point => camera.project(point))
  if (projected.every(point => !point)) return
  if (projected.some(point => !point)) {
    const clipped: ScreenPoint[] = []
    for (let i=0;i<points.length;i++) {
      const j=(i+1)%points.length
      if (projected[i] && projected[j]) clipped.push(projected[i]!)
      else if (projected[i] || projected[j]) {
        const edge=camera.segment(points[i],points[j])
        if (edge) clipped.push(...(projected[i]?edge:[edge[0]]))
      }
    }
    projected = clipped
  }
  if (projected.length<3) return
  if (projected.every(point => point!.x < 0) || projected.every(point => point!.x > camera.width)
    || projected.every(point => point!.y < 0) || projected.every(point => point!.y > camera.height)) return
  ctx.beginPath()
  ctx.moveTo(projected[0]!.x,projected[0]!.y)
  for(let i=1;i<projected.length;i++)ctx.lineTo(projected[i]!.x,projected[i]!.y)
  ctx.closePath()
  ctx.fillStyle=color
  ctx.fill()
}

function line(ctx: CanvasRenderingContext2D,camera:Camera,a:Vec3,b:Vec3,color:string,width=1):void {
  const pair=camera.segment(a,b)
  if(!pair)return
  ctx.beginPath()
  ctx.moveTo(pair[0].x,pair[0].y)
  ctx.lineTo(pair[1].x,pair[1].y)
  ctx.strokeStyle=color
  ctx.lineWidth=width
  ctx.stroke()
}

function disc(ctx:CanvasRenderingContext2D,x:number,y:number,radius:number,color:string):void {
  ctx.beginPath()
  ctx.arc(x,y,radius,0,Math.PI*2)
  ctx.fillStyle=color
  ctx.fill()
}

function sky(ctx:CanvasRenderingContext2D,camera:Camera):void {
  const {width,height}=camera
  const horizon = Math.max(-height,Math.min(height*2,height/2+Math.tan(camera.pitch*Math.PI/180)*camera.focal))
  const sky=ctx.createLinearGradient(0,horizon-height*.62,0,horizon+height*.37)
  sky.addColorStop(0,'#101820')
  sky.addColorStop(.42,'#28333f')
  sky.addColorStop(.61,'#686168')
  sky.addColorStop(.77,'#ba8d71')
  sky.addColorStop(1,'#515058')
  ctx.fillStyle=sky
  ctx.fillRect(0,0,width,height)
  const sun=camera.project(p(-51,46,228))
  if(sun && sun.x>-width&&sun.x<width*2&&sun.y>-height&&sun.y<height*2){
    const radius=Math.max(40,height*.26)
    const light=ctx.createRadialGradient(sun.x,sun.y,1,sun.x,sun.y,radius)
    light.addColorStop(0,'rgba(253,204,161,.57)')
    light.addColorStop(.16,'rgba(245,172,123,.21)')
    light.addColorStop(1,'rgba(239,141,94,0)')
    ctx.fillStyle=light
    ctx.fillRect(sun.x-radius,sun.y-radius,radius*2,radius*2)
    disc(ctx,sun.x,sun.y,Math.max(3,height*.009),'#e9b08c')
  }
  for(let i=0;i<8;i++){
    const x=-230+i*57+(i%3)*14,y=68+(i%4)*11,z=195+(i%2)*19
    polygon(ctx,camera,[p(x,y,z),p(x+13,y+3,z),p(x+65,y+4.4,z),p(x+105,y+2.8,z),p(x+62,y+1.1,z)],i%2?'#96909a26':'#bea79c24')
  }
}

function drawBoard(ctx:CanvasRenderingContext2D,camera:Camera,z:number):void {
  const left=BOARD_LEFT,right=BOARD_RIGHT,bottom=BOARD_BOTTOM,top=BOARD_TOP
  const plate=(x1:number,y1:number,x2:number,y2:number,offset:number,color:string) => polygon(ctx,camera,front(x1,y1,x2,y2,z+offset),color)
  const edge=(x1:number,y1:number,x2:number,y2:number,color:string,width=1)=>line(ctx,camera,p(x1,y1,z-.09),p(x2,y2,z-.09),color,width)
  polygon(ctx,camera,ground(left-.65,z-.82,right+.65,z+.86,.015),'#22282c')
  plate(left-.28,.05,right+.28,.36,-.061,'#503a32')
  plate(left-.10,bottom+.01,right+.1,top+.12,.28,'#805139')
  polygon(ctx,camera,[p(right,bottom,z),p(right+.1,bottom,z+.28),p(right+.1,top+.12,z+.28),p(right,top,z)],'#59443c')
  polygon(ctx,camera,[p(left+.31,bottom,z),p(right-.31,bottom,z),p(right,bottom+.32,z),p(right,top-.28,z),p(right-.31,top,z),p(left+.31,top,z),p(left,top-.28,z),p(left,bottom+.32,z)],'#877261')
  plate(left+.15,bottom+.16,right-.15,top-.16,-.026,'#1e2a32')
  plate(left+.25,bottom+.26,right-.25,top-.27,-.049,'#26333c')
  for(let x=-3.25;x<3.3;x+=.5)edge(x,bottom+.26,x,top-.27,'#5e687157',.8)
  for(let y=bottom+.26;y<top-.27;y+=.5)edge(left+.25,y,right-.25,y,'#5e687157',.8)
  edge(left+.25,BOARD_AIM_Y,right-.25,BOARD_AIM_Y,'#70858b88')
  edge(0,bottom+.26,0,top-.27,'#70858b88')
  for (const radius of [.54,1.03,1.46]) {
    for(let i=0;i<36;i++){
      const a=i*Math.PI/18,b=(i+1)*Math.PI/18
      edge(radius*Math.cos(a),BOARD_AIM_Y+radius*Math.sin(a),radius*Math.cos(b),BOARD_AIM_Y+radius*Math.sin(b),radius===.54?'#84a7a2':'#6d8389a9',radius===.54?1.1:.8)
    }
  }
  for (const side of [-1,1]) {
    const x=side*3.52
    for(const y of [bottom+.3,top-.31]){
      edge(x-.18,y,x+.18,y,orange,2)
      const rivet=camera.project(p(x*.92,y,z-.091))
      if(rivet)disc(ctx,rivet.x,rivet.y,Math.max(1,camera.focal/rivet.depth*.065),'#ab9b90')
    }
    edge(side*.19,BOARD_AIM_Y,side*.44,BOARD_AIM_Y,teal)
    edge(0,BOARD_AIM_Y+side*.19,0,BOARD_AIM_Y+side*.44,teal)
  }
  const center=camera.project(p(0,BOARD_AIM_Y,z-.11))
  if(center)disc(ctx,center.x,center.y,Math.max(.9,camera.focal/center.depth*.05),'#edc5a3')
  const id=camera.project(p(0,top-.62,z-.11))
  if(id){
    const size=Math.max(6,Math.min(17,.21*camera.focal/id.depth))
    ctx.fillStyle='#bdc1b9'
    ctx.font=`600 ${size}px monospace`
    ctx.textAlign='center'
    ctx.fillText('RECOIL PLATE',id.x,id.y)
  }
}

function drawTarget(ctx:CanvasRenderingContext2D,camera:Camera,target:Target):void {
  const base=camera.project(p(target.x,.02,target.z))
  if(!base)return
  const scale=camera.focal/base.depth
  if(scale<.5||base.x<-scale*2||base.x>camera.width+scale*2)return
  polygon(ctx,camera,ground(target.x-.42,target.z-.42,target.x+.42,target.z+.45,.018),'#191f22b5')
  if(target.dead){
    polygon(ctx,camera,front(target.x-.33,.03,target.x+.31,.18,target.z),'#5a5149')
    return
  }
  const z=target.z
  const h=target.height
  const part=(points:[number,number][],color:string)=>polygon(ctx,camera,points.map(([x,y])=>p(target.x+x,h*y,z)),color)
  const shieldColor = armorTint(target.maxArmor)
  const aura = target.flashShield ? shieldColor : '#ffb399'
  const movement = target.kind==='moving'?Math.sin((target.x-target.homeX)*6)*.035:0
  for (const s of [-1,1]) {
    const step=movement*s
    part([[s*.068,.49],[s*.213,.44],[s*(.22+step),.19],[s*(.23+step),.026],[s*(.082+step),.023],[s*(.078+step),.18],[s*.055,.32]],'#202631')
    part([[s*.072,.45],[s*.188,.43],[s*(.179+step),.253],[s*(.079+step),.245]],'#7b7783')
    part([[s*(.084+step),.216],[s*(.194+step),.221],[s*(.175+step),.066],[s*(.094+step),.066]],'#9b9194')
    part([[s*.166,.745],[s*.278,.73],[s*.327,.675],[s*.306,.52],[s*.25,.49],[s*.206,.55],[s*.201,.65]],'#3e3e4c')
    part([[s*.193,.745],[s*.28,.728],[s*.311,.669],[s*.22,.653]],'#a8a0a5')
    part([[s*.255,.604],[s*.304,.588],[s*.298,.526],[s*.252,.52]],'#877575')
  }
  part([[-.221,.746],[-.089,.781],[.089,.781],[.221,.746],[.177,.516],[.129,.444],[-.131,.444],[-.172,.516]],'#363943')
  part([[-.175,.72],[-.099,.757],[.094,.757],[.177,.72],[.136,.62],[0,.584],[-.136,.621]],'#a69ca2')
  part([[-.076,.71],[0,.731],[.077,.709],[.069,.661],[0,.632],[-.069,.661]],target.armor>0?shieldColor:'#bb7467')
  part([[-.13,.567],[.136,.567],[.133,.501],[.081,.481],[-.08,.481],[-.131,.5]],'#5c5b65')
  part([[-.07,.78],[.07,.78],[.082,.864],[-.082,.864]],'#67616a')
  part([[-.09,.85],[-.13,.89],[-.115,.964],[-.069,.993],[.07,1],[.12,.964],[.134,.891],[.09,.85]],'#b3a4a2')
  part([[-.11,.923],[-.067,.934],[.077,.937],[.115,.925],[.103,.889],[-.095,.89]],'#292734')
  part([[-.101,.917],[.106,.921],[.091,.906],[-.088,.904]],'#ed9d86')
  const above=camera.project(p(target.x,h+.2,z))
  if(!above)return
  const width=Math.max(13,Math.min(43,.92*scale))
  const height=scale>30?3:2
  ctx.fillStyle='#1b2027'
  ctx.fillRect(above.x-width/2-1,above.y-height-1,width+2,height*2+3)
  if(target.maxArmor){
    ctx.fillStyle=shieldColor
    ctx.fillRect(above.x-width/2,above.y-height,width*target.armor/target.maxArmor,height)
  }
  ctx.fillStyle='#e1c4b8'
  ctx.fillRect(above.x-width/2,above.y+1,width*target.hp/100,height)
  if(target.hitFlash){
    const center=camera.project(p(target.x,h*.61,z-.03))
    if(center){
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(center.x,center.y,Math.max(2,scale*.39),Math.max(4,scale*h*.43),0,0,Math.PI*2)
      ctx.strokeStyle=aura
      ctx.lineWidth=1.5
      ctx.globalAlpha=target.hitFlash/.19
      ctx.stroke()
      ctx.restore()
    }
  }
}

function marks(ctx:CanvasRenderingContext2D,camera:Camera,arena:Arena):void {
  let last:ScreenPoint|null=null
  for(const impact of arena.impacts){
    const spot=camera.project(impact.point)
    if(!spot){last=null;continue}
    if(impact.kind==='board'){
      if(last){
        ctx.beginPath()
        ctx.moveTo(last.x,last.y)
        ctx.lineTo(spot.x,spot.y)
        ctx.strokeStyle='#ff9167ac'
        ctx.lineWidth=1.35
        ctx.stroke()
      }
      const radius=Math.max(1.45,Math.min(3,camera.focal/spot.depth*.11))
      disc(ctx,spot.x,spot.y,radius+1,'#f08b59')
      disc(ctx,spot.x,spot.y,radius,'#1b2229')
      last=spot
      continue
    }
    ctx.save()
    ctx.globalAlpha=Math.max(0,1-impact.age/(impact.kind==='miss'?.34:.24))
    const armor = impact.kind === 'shield' ? arena.targets.find(target => target.id === impact.targetId)?.maxArmor : undefined
    const color=armor!==undefined?armorTint(armor):impact.kind==='flesh'?'#ff926c':'#f0c086'
    const spread=1+impact.age*17
    for(let i=0;i<5;i++){
      const angle=i*2.39996+impact.point.x
      disc(ctx,spot.x+Math.cos(angle)*spread,spot.y+Math.sin(angle)*spread,1.05,color)
    }
    ctx.restore()
  }
}

export class World {
  draw(ctx:CanvasRenderingContext2D,camera:Camera,arena:Arena):void {
    ctx.save()
    sky(ctx,camera)
    for(const face of terrain)polygon(ctx,camera,face.points,face.color)
    polygon(ctx,camera,ground(-110,-38,110,146,-.006),'#292c32')
    for(const face of floor)polygon(ctx,camera,face.points,face.color)
    for(const face of structures)polygon(ctx,camera,face.points,face.color)
    for(const panel of panels){
      const projected=camera.project(panel.at)
      if(!projected)continue
      const size=Math.min(30,camera.focal*panel.height/projected.depth)
      if(size<4)continue
      ctx.fillStyle=panel.color
      ctx.font=`700 ${size}px monospace`
      ctx.textAlign='center'
      ctx.textBaseline='middle'
      ctx.fillText(panel.text,projected.x,projected.y)
    }
    if(arena.mode==='recoil')drawBoard(ctx,camera,arena.distance)
    else for(const target of [...arena.targets].sort((a,b)=>b.z-a.z))drawTarget(ctx,camera,target)
    marks(ctx,camera,arena)
    const edge=ctx.createRadialGradient(camera.width*.5,camera.height*.48,camera.height*.29,camera.width*.5,camera.height*.48,Math.max(camera.width*.66,camera.height*.66))
    edge.addColorStop(0,'#10121900')
    edge.addColorStop(1,'#1012199e')
    ctx.fillStyle=edge
    ctx.fillRect(0,0,camera.width,camera.height)
    ctx.restore()
  }
}
