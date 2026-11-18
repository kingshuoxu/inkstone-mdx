import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
for (const [kind,bytes,repeat] of [['rich',5*1024*1024,3],['long',5*1024*1024,1],['rich',1024*1024,1]]) {
 for(let run=0;run<repeat;run++)test(`${kind}-${bytes}-${run}`,async({page},info)=>{
 test.setTimeout(300000);
 page.on('dialog',d=>d.accept());
 await page.goto('/');
 await expect(page.locator('#compile-status')).toHaveAttribute('data-state','ready');
 const unit=kind==='rich'?'# Heading\n\n**bold** *italic* ~~strike~~ [link](https://example.com)\n\n':'ordinary paragraph '.repeat(200)+'\n\n';
 const prefix='# FULL DOCUMENT TOP\n\n',tail='\n\n# UNIQUE FULL DOCUMENT END\n\n<Counter />\n\n<Badge>{6 * 7}</Badge>\n';
 const source=prefix+unit.repeat(Math.floor((bytes-8192-prefix.length-tail.length)/unit.length))+tail;
 await page.locator('#file-input').setInputFiles({name:'profile.mdx',mimeType:'text/plain',buffer:Buffer.from(source)});
 await expect(page.locator('iframe')).toHaveCount(0);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Performance.enable');
 await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReturnAsStream'});
 await page.locator('#pause').click();
 await expect(page.locator('#compile-status')).toHaveAttribute('data-state','ready',{timeout:180000});
 await page.waitForFunction(()=>window.profile?.twoFrames);
 const result=await page.evaluate(()=>structuredClone(window.profile));
 const metrics=await cdp.send('Performance.getMetrics');
 const traceComplete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
 await cdp.send('Tracing.end');
 const {stream}=await traceComplete;let trace='';while(true){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break;}await cdp.send('IO.close',{handle:stream});
 const events=JSON.parse(trace).traceEvents;
 const summary={};for(const e of events)if(e.ph==='X'&&['Layout','UpdateLayoutTree','Paint','PrePaint','ParseHTML','CompileScript','EvaluateScript','FunctionCall','RunTask','V8.GCCompactor','MinorGC','MajorGC'].includes(e.name)){const x=summary[e.name]||={ms:0,count:0};x.ms+=(e.dur||0)/1000;x.count++;}
 const frame=page.frameLocator('iframe:not([data-pending])');
 await expect(frame.locator('h1').last()).toHaveText('UNIQUE FULL DOCUMENT END');
 const counts=await page.frames().find(f=>f!==page.mainFrame()).evaluate(()=>({nodes:document.querySelectorAll('*').length,headings:document.querySelectorAll('h1').length}));
 Object.assign(result,{kind,bytes:Buffer.byteLength(source),run,counts,traceSummary:summary,cdpMetrics:metrics.metrics});
 await writeFile(`diagnostics/result-${kind}-${bytes}-${run}.json`,JSON.stringify(result,null,2));
 await writeFile(`diagnostics/trace-${kind}-${bytes}-${run}.json`,trace);
 console.log('PROFILE_RESULT',JSON.stringify(result));
 });
}
