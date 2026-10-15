/* =========================================================
   TWKTK WORLDLINE — asset manifest
   Drop new images into assets/images/... and list them here.
   Every gallery below is reachable in-world:
   - "editions" opens from the Museum photo frames
   - stall keys open from their experience displays + venue stalls
   Missing files fail gracefully (branded fallback art is shown).
   ========================================================= */
window.TWKTK_ASSETS = {
  logo: 'assets/brand/logo.png',
  emergence: 'assets/brand/emergence.png',
  galleries: {
    editions: {
      title: 'PREVIOUS EDITIONS',
      items: [
        { src: 'assets/images/museum/editions/e01.jpg', cap: 'EDITION ARCHIVE — 01' },
        { src: 'assets/images/museum/editions/e02.jpg', cap: 'EDITION ARCHIVE — 02' },
        { src: 'assets/images/museum/editions/e03.jpg', cap: 'EDITION ARCHIVE — 03' },
        { src: 'assets/images/museum/editions/e04.jpg', cap: 'EDITION ARCHIVE — 04' },
        { src: 'assets/images/museum/editions/e05.jpg', cap: 'EDITION ARCHIVE — 05' },
        { src: 'assets/images/museum/editions/e06.jpg', cap: 'EDITION ARCHIVE — 06' },
        { src: 'assets/images/museum/editions/e07.jpg', cap: 'EDITION ARCHIVE — 07' },
        { src: 'assets/images/museum/editions/e08.jpg', cap: 'THE MESH — THOSE WHO KNOW THEY KNOW' },
        { src: 'assets/images/museum/editions/e09.jpg', cap: 'EDITION ARCHIVE — 09' },
        { src: 'assets/images/museum/editions/e10.jpg', cap: 'EDITION ARCHIVE — 10' },
        { src: 'assets/images/museum/editions/e11.jpg', cap: 'EDITION ARCHIVE — 11' },
        { src: 'assets/images/museum/editions/e12.jpg', cap: 'THE FLOOR — FULL HOUSE' },
        { src: 'assets/images/museum/editions/e13.jpg', cap: 'EDITION ARCHIVE — 13' },
        { src: 'assets/images/museum/editions/e14.jpg', cap: 'EDITION ARCHIVE — 14' },
        { src: 'assets/images/museum/editions/e15.jpg', cap: 'EDITION ARCHIVE — 15' }
      ]
    },
    fashion: { title: 'FASHION INSTALLATION', items: [
      { src: 'assets/images/experiences/x01.jpg', cap: 'AFTERS AT — ON THE FLOOR' },
      { src: 'assets/images/experiences/x02.jpg', cap: 'CHROME COLLECTION' } ] },
    art: { title: 'ART EXPERIENCE', items: [
      { src: 'assets/images/experiences/x03.jpg', cap: 'INSTALLATIONS IN THE WILD' },
      { src: 'assets/images/experiences/x04.jpg', cap: 'MADE FOR ONE NIGHT' } ] },
    bar: { title: 'BAR EXPERIENCE', items: [
      { src: 'assets/images/experiences/x05.jpg', cap: 'PREMIUM POURS' },
      { src: 'assets/images/experiences/x06.jpg', cap: 'THE COUNTER AT 1AM' } ] },
    stage: { title: 'STAGE EXPERIENCE', items: [
      { src: 'assets/images/experiences/x07.jpg', cap: 'PRODUCTION AT SCALE' },
      { src: 'assets/images/experiences/x08.jpg', cap: 'THE REVEAL MOMENT' } ] },
    holo: { title: 'HOLO EXPERIENCE', items: [
      { src: 'assets/images/experiences/x09.jpg', cap: 'LIGHT AS ARCHITECTURE' } ] },
    food: { title: 'FOOD EXPERIENCE', items: [
      { src: 'assets/images/experiences/x10.jpg', cap: 'OPEN TILL SUNRISE' } ] }
  }
};
