import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App';
import CartProvider from './contexts/CartProvider';
import MemberProvider from './contexts/MemberProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MemberProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </MemberProvider>
    </BrowserRouter>
  </StrictMode>
);
