// Read native appearance; never write native classes, preferences or color-scheme.
export function readAppearance(document, systemDark=false) {
  const nodes=[document.documentElement,document.body].filter(Boolean);
  for(const node of nodes){if(node.classList.contains('electron-dark'))return 'dark';if(node.classList.contains('electron-light'))return 'light';}
  for(const node of nodes){const value=node.style.colorScheme;if(value==='dark'||value==='light')return value;}
  for(const node of nodes){for(const attr of ['data-theme','data-appearance','data-color-mode','data-color-scheme']){const v=node.getAttribute(attr);if(v==='dark'||v==='light')return v;}}
  for(const node of nodes){if(node.classList.contains('dark'))return 'dark';if(node.classList.contains('light'))return 'light';}
  const scheme=document.documentElement.style.colorScheme||document.defaultView.getComputedStyle(document.documentElement).colorScheme;
  if(scheme==='dark'||scheme==='light')return scheme;
  return systemDark?'dark':'light';
}
