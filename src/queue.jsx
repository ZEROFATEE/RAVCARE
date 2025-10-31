import { StrictMode, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { createRoot } from 'react-dom/client';
import { queueNum } from './QueueSignals';
import { getCurrentWebview } from '@tauri-apps/api/webview';

function Queue() {
  const [list, setList] = useState(0);

  useEffect(() => {
    const webview = getCurrentWebview();
    const unlisten = webview.listen('queue-update', (event) => {
      console.log(event.payload.number)
      queueNum.value = event.payload.number
      console.log(queueNum.value)
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 32, fontSize: 32, fontFamily: 'system-ui' }}>
      <h1>Queue</h1>
      <div>
        <span>{queueNum}</span>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Queue />
  </StrictMode>,
)