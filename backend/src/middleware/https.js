exports.enforceHttps = (req, res, next) => {
  if (process.env.REQUIRE_HTTPS !== 'true') return next();

  const forwardedProto = req.headers['x-forwarded-proto'];
  if (req.secure || forwardedProto === 'https') return next();

  return res.status(426).json({
    success: false,
    message: 'HTTPS is required for this environment'
  });
};
