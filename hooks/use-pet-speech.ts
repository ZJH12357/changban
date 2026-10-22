'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type PetSpeech={supported:boolean;speaking:boolean;status:string;activate:()=>void;speak:(text:string)=>void;stop:()=>void;preview:()=>void};
export function usePetSpeech(enabled:boolean,rate:number,identity:string|null,petName:string='团团'):PetSpeech {
 const [supported,setSupported]=useState(false),[speaking,setSpeaking]=useState(false),[armed,setArmed]=useState(false),[message,setMessage]=useState('');
 const gate=useRef({enabled,rate});gate.current={enabled,rate};
 const armedRef=useRef(false),generation=useRef(0),utterance=useRef<SpeechSynthesisUtterance|null>(null);
 const stop=useCallback(()=>{generation.current++;if(typeof window!=='undefined'&&window.speechSynthesis&&utterance.current)window.speechSynthesis.cancel();utterance.current=null;setSpeaking(false);},[]);
 const activate=useCallback(()=>{if(gate.current.enabled){armedRef.current=true;setArmed(true);}},[]);
 const speak=useCallback((text:string)=>{
  if(!gate.current.enabled||!armedRef.current||document.hidden||!window.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined')return;
  stop();const voices=window.speechSynthesis.getVoices(),chinese=voices.filter(v=>/^zh/i.test(v.lang));
  if(voices.length&&!chinese.length){setMessage('设备尚未提供中文语音，请安装中文语音包；文字陪伴仍可使用。');return;}
  const u=new SpeechSynthesisUtterance(text.slice(0,600)),version=generation.current;
  u.lang='zh-CN';u.rate=gate.current.rate;u.volume=0.8;u.voice=chinese.find(v=>v.localService)??chinese[0]??null;
  u.onstart=()=>{if(generation.current===version){setSpeaking(true);setMessage(`${petName}正在说话…`);}};
  u.onend=()=>{if(generation.current===version){setSpeaking(false);utterance.current=null;setMessage('播报结束，可点击气泡“再听一遍”。');}};
  u.onerror=()=>{if(generation.current===version){setSpeaking(false);utterance.current=null;setMessage('未能播放，请检查音量，或再次点击“允许播放并试听”。文字提示不受影响。');}};
  utterance.current=u;try{window.speechSynthesis.speak(u);}catch{utterance.current=null;setSpeaking(false);setMessage('当前浏览器无法播报，请使用文字提示。');}
 },[stop,petName]);
 const preview=useCallback(()=>{activate();speak(`您好，我是${petName}。我会陪您记着今天的小安排，也会温柔地回应您。`);},[activate,speak,petName]);
 useEffect(()=>{setSupported(!!window.speechSynthesis&&typeof SpeechSynthesisUtterance!=='undefined');const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);stop();};},[stop]);
 useEffect(()=>{stop();armedRef.current=false;setArmed(false);setMessage('');},[enabled,identity,rate,petName,stop]);
 return {supported,speaking,activate,speak,stop,preview,status:!supported?'此浏览器暂不支持语音，文字陪伴照常。':!enabled?'语音已关闭。':!armed?`请点击“允许播放并试听”，或单击${petName}，授权本页播放。`:message||'已允许本页播放。'};
}
