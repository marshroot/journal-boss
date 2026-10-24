import { useEffect, useRef, useState } from 'react';
import { Canvas, Circle, FabricImage, IText, PencilBrush, Rect } from 'fabric';
import { Download, ImagePlus, RotateCw, Square, Circle as CircleIcon, Type, Undo2, Redo2, Trash2, ZoomIn, ZoomOut, ImageIcon } from 'lucide-react';
import SuperficialFeature from '../components/journal/SuperficialFeature';

const PURPLE = '#30ff44';

export default function ImageEditorPage(){
  const role = JSON.parse(localStorage.getItem('authUser') || '{}')?.role;
  if (role === 'Student') {
    return (
      <div className="p-4 md:p-6">
        <SuperficialFeature
          title="Редактор изображений"
          description="Встроенный графический редактор на базе Fabric.js с поддержкой фигур, текста, изображений и истории изменений. Для студентов раздел будет доступен в полном объёме в ближайшем обновлении."
          eyebrow="Мод · Графика"
          icon={<ImageIcon size={20} />}
        />
      </div>
    );
  }
  const hostRef=useRef<HTMLDivElement>(null);
  const canvasRef=useRef<Canvas|null>(null);
  const historyRef=useRef<string[]>([]);
  const historyIndexRef=useRef(-1);
  const restoringRef=useRef(false);
  const [historyState,setHistoryState]=useState({canUndo:false,canRedo:false});
  const [zoom,setZoom]=useState(1);

  const snapshot=()=>{
    const canvas=canvasRef.current;if(!canvas||restoringRef.current)return;
    const json=JSON.stringify(canvas.toJSON());
    const history=historyRef.current;
    if(history[historyIndexRef.current]===json)return;
    history.splice(historyIndexRef.current+1);
    history.push(json);
    historyIndexRef.current=history.length-1;
    setHistoryState({canUndo:historyIndexRef.current>0,canRedo:false});
  };

  useEffect(()=>{
    if(!hostRef.current)return;
    const el=document.createElement('canvas'); el.width=1200; el.height=680; el.className='image-editor-canvas'; hostRef.current.appendChild(el);
    const canvas=new Canvas(el,{backgroundColor:'#0d0d12',preserveObjectStacking:true,selection:true});
    canvasRef.current=canvas;
    const resize=()=>{
      const box=hostRef.current?.getBoundingClientRect(); if(!box)return;
      const maxW=Math.max(320,box.width-32); const scale=Math.min(1,maxW/1200);
      canvas.setDimensions({width:1200*scale,height:680*scale}); canvas.setZoom(scale); setZoom(scale);
    };
    resize(); window.addEventListener('resize',resize);
    canvas.on('object:added',snapshot);canvas.on('object:modified',snapshot);canvas.on('object:removed',snapshot);
    snapshot();
    return()=>{window.removeEventListener('resize',resize);void canvas.dispose();canvasRef.current=null};
  },[]);

  const restore=async(index:number)=>{
    const canvas=canvasRef.current;const json=historyRef.current[index];if(!canvas||!json)return;
    restoringRef.current=true; await canvas.loadFromJSON(JSON.parse(json)); canvas.requestRenderAll(); restoringRef.current=false;
    historyIndexRef.current=index; setHistoryState({canUndo:index>0,canRedo:index<historyRef.current.length-1});
  };
  const undo=()=>{if(historyIndexRef.current>0)void restore(historyIndexRef.current-1)};
  const redo=()=>{if(historyIndexRef.current<historyRef.current.length-1)void restore(historyIndexRef.current+1)};
  const addText=()=>{const c=canvasRef.current;if(!c)return;const t=new IText('Новый текст',{left:120,top:100,fill:'#fff',fontSize:42,fontFamily:'Inter',fontWeight:'600'});c.add(t);c.setActiveObject(t);c.requestRenderAll()};
  const addRect=()=>{const c=canvasRef.current;if(!c)return;c.add(new Rect({left:160,top:160,width:220,height:140,fill:'rgba(0, 230, 150,.16)',stroke:PURPLE,strokeWidth:3,rx:16,ry:16}));c.requestRenderAll()};
  const addCircle=()=>{const c=canvasRef.current;if(!c)return;c.add(new Circle({left:240,top:180,radius:75,fill:'rgb(var(--os-fg-rgb)/.06)',stroke:'#7dffc4',strokeWidth:3}));c.requestRenderAll()};
  const toggleDraw=()=>{const c=canvasRef.current;if(!c)return;if(c.isDrawingMode){c.isDrawingMode=false}else{const brush=new PencilBrush(c);brush.color=PURPLE;brush.width=5;c.freeDrawingBrush=brush;c.isDrawingMode=true}};
  const rotate=()=>{const c=canvasRef.current;const o=c.getActiveObject();if(!c||!o)return;o.rotate((o.angle||0)+90);o.setCoords();c.requestRenderAll();snapshot()};
  const resizeCanvas=()=>{const c=canvasRef.current;if(!c)return;const w=Number(prompt('Ширина холста, px',String(Math.round(c.getWidth()/Math.max(c.getZoom(),.01)))));const h=Number(prompt('Высота холста, px',String(Math.round(c.getHeight()/Math.max(c.getZoom(),.01)))));if(!Number.isFinite(w)||!Number.isFinite(h)||w<320||h<180||w>2400||h>1600)return;c.setDimensions({width:w,height:h});c.requestRenderAll();snapshot()};
  const cropToActive=()=>{const c=canvasRef.current;const o=c.getActiveObject();if(!c||!o)return;const r=o.getBoundingRect();if(r.width<40||r.height<40)return;c.setDimensions({width:Math.max(320,r.width+40),height:Math.max(180,r.height+40)});c.setViewportTransform([1,0,0,1,-r.left+20,-r.top+20]);c.requestRenderAll();snapshot()};
  const remove=()=>{const c=canvasRef.current;if(!c)return;c.remove(...c.getActiveObjects());c.discardActiveObject();c.requestRenderAll();snapshot()};
  const zoomBy=(factor:number)=>{const c=canvasRef.current;if(!c)return;const next=Math.max(.45,Math.min(1.6,c.getZoom()*factor));c.setZoom(next);setZoom(next)};
  const importImage=(file:File)=>{const reader=new FileReader();reader.onload=()=>{const c=canvasRef.current;if(!c||typeof reader.result!=='string')return;void FabricImage.fromURL(reader.result).then(img=>{const maxW=720,maxH=420;const scale=Math.min(maxW/(img.width||1),maxH/(img.height||1),1);img.set({left:80,top:80,scaleX:scale,scaleY:scale});c.add(img);c.setActiveObject(img);c.requestRenderAll()})};reader.readAsDataURL(file)};
  const exportPng=()=>{const c=canvasRef.current;if(!c)return;const data=c.toDataURL({format:'png',multiplier:1/Math.max(c.getZoom(),.01)});const a=document.createElement('a');a.href=data;a.download='journal-image.png';a.click()};

  return <div className="page-shell image-editor-page">
    <div className="page-heading"><div className="page-heading-icon"><ImagePlus size={20}/></div><div><div className="page-eyebrow">Творческие инструменты</div><h1>Редактор изображений</h1><p>Обрезка, масштабирование, поворот, текст, фигуры и рисование — без выхода из журнала.</p></div></div>
    <div className="image-editor-layout panel">
      <div className="image-editor-toolbar">
        <label className="tool-button"><ImagePlus size={16}/>Загрузить<input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importImage(f);e.currentTarget.value=''}}/></label>
        <button className="tool-button" onClick={addText}><Type size={16}/>Текст</button><button className="tool-button" onClick={addRect}><Square size={16}/>Прямоугольник</button><button className="tool-button" onClick={addCircle}><CircleIcon size={16}/>Круг</button><button className="tool-button" onClick={toggleDraw}>✎ Рисовать</button><button className="tool-button" onClick={rotate}><RotateCw size={16}/>Повернуть</button><button className="tool-button" onClick={resizeCanvas}>Размер</button><button className="tool-button" onClick={cropToActive}>Обрезать</button><button className="tool-button danger" onClick={remove}><Trash2 size={16}/>Удалить</button>
        <span className="tool-spacer"/><button className="icon-button" disabled={!historyState.canUndo} onClick={undo}><Undo2 size={17}/></button><button className="icon-button" disabled={!historyState.canRedo} onClick={redo}><Redo2 size={17}/></button><button className="icon-button" onClick={()=>zoomBy(.9)}><ZoomOut size={17}/></button><span className="zoom-value">{Math.round(zoom*100)}%</span><button className="icon-button" onClick={()=>zoomBy(1.1)}><ZoomIn size={17}/></button><button className="export-button" onClick={exportPng}><Download size={16}/>Экспорт PNG</button>
      </div>
      <div className="image-editor-workspace"><div ref={hostRef} className="image-editor-canvas-host"/><div className="image-editor-tip">Выберите объект на холсте, чтобы изменить его размер, положение или угол. Ctrl/Cmd+Z отменяет последнее действие.</div></div>
    </div>
  </div>
}
