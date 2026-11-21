// Configuração pública de implantação, sem segredos.
// Por padrão, /api é acessado na mesma origem. Para backend separado, informe sua URL HTTPS.
// semIA: true liga o modo estudo, sem IA e sem backend (o build do GitHub Pages, em .github/workflows/publicar.yml).
window.CEREBRO_CONFIG = { demo: false, apiBaseUrl: '' };
