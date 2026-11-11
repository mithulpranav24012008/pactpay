import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { AllCommunityModule, ModuleRegistry } from 'ag-charts-community';

// AG Charts v13+ renders nothing (and throws) unless its modules are registered first.
ModuleRegistry.registerModules([AllCommunityModule]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
