const Job = require('../src/models/Job');

describe('Job lifecycle schema', () => {
  test('new jobs default to open local work', () => {
    expect(Job.schema.path('status').defaultValue).toBe('Open');
    expect(Job.schema.path('serviceType').defaultValue).toBe('local');
  });

  test('supports the states used by the customer-to-provider flow', () => {
    expect(Job.schema.path('status').enumValues).toEqual(
      expect.arrayContaining(['Open', 'Assigned', 'In-Progress', 'Completed', 'Closed'])
    );
    expect(Job.schema.path('hiredProvider').options.ref).toBe('User');
  });
});
