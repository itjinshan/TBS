// WeChatIcon.js
import React from 'react';

export default function WeChatIcon({ size = 24, color = '#07C160' }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24"
      width={size}
      height={size}
    >
      <path fill={color} d="M8.5 4.5c-3.6 0-6.5 2.5-6.5 5.5 0 1.7.9 3.2 2.3 4.2l-.6 2.1 2.2-.9c.9.3 1.9.5 2.9.5.4 0 .8 0 1.2-.1-.2-.7-.3-1.4-.3-2.1 0-3.1 2.8-5.7 6.2-5.7.4 0 .8 0 1.2.1C14.4 6.6 11.7 4.5 8.5 4.5zm7.5 9c-2.8 0-5 1.8-5 4s2.2 4 5 4c.6 0 1.2-.1 1.8-.3l1.5.6-.4-1.4c1.1-.8 1.8-2 1.8-3.3 0-2.2-2.2-4-5-4z"/>
    </svg>
  );
}