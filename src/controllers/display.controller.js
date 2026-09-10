const { buildPublicDisplayData } = require('../services/publicDisplayData');

const clampRefresh = () => Math.max(3000, Math.min(60000, Number(process.env.DISPLAY_REFRESH_MS || 5000)));

exports.index = async (req, res, next) => {
  try {
    const data = await buildPublicDisplayData();
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow, noarchive'
    });
    res.render('display/index', {
      title: 'Katta ekran — Jonli statistika',
      displayData: data,
      displayTitle: process.env.DISPLAY_TITLE || 'MD',
      displaySubtitle: process.env.DISPLAY_SUBTITLE || 'Magistratura — jonli monitoring',
      displayTheme: req.query.theme === 'dark' ? 'dark' : 'light',
      kioskMode: req.query.kiosk === '1'
    });
  } catch (error) { next(error); }
};

exports.live = async (req, res, next) => {
  try {
    const initial = await buildPublicDisplayData();
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Robots-Tag': 'noindex, nofollow, noarchive'
    });
    res.flushHeaders?.();

    let closed = false;
    let running = false;
    const write = data => {
      if (!closed && !res.writableEnded) res.write(`event: stats\ndata: ${JSON.stringify(data)}\n\n`);
    };
    write(initial);

    const refresh = async () => {
      if (closed || running) return;
      running = true;
      try { write(await buildPublicDisplayData()); }
      catch (_) {
        if (!closed && !res.writableEnded) res.write('event: stats-error\ndata: {}\n\n');
      } finally { running = false; }
    };

    const refreshTimer = setInterval(refresh, clampRefresh());
    const heartbeatTimer = setInterval(() => {
      if (!closed && !res.writableEnded) res.write(': display-heartbeat\n\n');
    }, 20000);
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(refreshTimer);
      clearInterval(heartbeatTimer);
    };
    req.on('close', cleanup);
    res.on('close', cleanup);
  } catch (error) { next(error); }
};
