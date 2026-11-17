import React, {useState} from 'react';
import clsx from 'clsx';
export default function Welcome(){const [n,set]=useState(0);return <button className={clsx('counter',n>0&&'active')} onClick={()=>set(n+1)}>Project component: {n}</button>}
