const User = require('../src/models/User');

describe('user roles for the job workflow', () => {
  test('new accounts default to customer and can register as providers', () => {
    expect(User.schema.path('role').defaultValue).toBe('customer');
    expect(User.schema.path('role').enumValues).toEqual(['customer', 'provider', 'admin']);
  });

  test('passwords are excluded from normal user queries', () => {
    expect(User.schema.path('password').options.select).toBe(false);
  });
});
