// Configurazione per ricompilare tailwind.css (stessi colori che prima stavano in index.html)
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: { extend: { colors: {
    burgundy: { DEFAULT: '#5e2038', light: '#7a2d4a', soft: '#fcf6f8', dark: '#421627' },
    whatsapp: { light: '#d9fdd3', dark: '#005c4b' }
  } } }
};
