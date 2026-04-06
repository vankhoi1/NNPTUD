function ok(message, data = null) {
  return {
    success: true,
    message,
    data
  };
}

function fail(message, data = null) {
  return {
    success: false,
    message,
    data
  };
}

function notFound(message = 'Resource not found') {
  return fail(message);
}

module.exports = {
  ok,
  fail,
  notFound
};
