const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Job = require('../src/models/Job');
const Application = require('../src/models/Application');
process.env.MONGO_URI ||= 'mongodb://127.0.0.1/skillbridge_test';
const jobService = require('../src/services/jobService');

const customer = new mongoose.Types.ObjectId();
const worker = new mongoose.Types.ObjectId();
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const jobs = Array.from({ length: 14 }, (_, index) => ({
    _id: new mongoose.Types.ObjectId(),
    customer,
    title: `Job ${index + 1}`,
    budget: 499,
    status: ['Open', 'Assigned', 'In-Progress', 'Completed', 'Closed', 'Cancelled', 'Open'][index % 7],
    createdAt: new Date(Date.UTC(2026, 10, index + 1)),
    deadline: new Date(Date.UTC(2026, 11, 20 - index)),
  }));
  await Job.collection.insertMany([...jobs, { ...jobs[0], _id: new mongoose.Types.ObjectId(), customer: worker }]);
  await Application.collection.insertMany([
    { job: jobs[0]._id, worker, status: 'Pending' },
    { job: jobs[0]._id, worker: new mongoose.Types.ObjectId(), status: 'Pending' },
    { job: jobs[4]._id, worker, status: 'Pending' },
    { job: jobs[6]._id, worker, status: 'Rejected' },
  ]);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('reports account-wide counts across pages and groups each job once', async () => {
  const [first, second] = await Promise.all([1, 2].map((page) => jobService.getMyJobs(customer, { view: 'all', page })));
  expect(first.counts).toEqual({ all: 14, active: 7, applied: 1, completed: 2, cancelled: 4 });
  expect(second.counts).toEqual(first.counts);
  expect(first.jobs).toHaveLength(10);
  expect(second.jobs).toHaveLength(4);
  expect(first.jobs[0].title).toBe('Job 14');
  expect(new Set([...first.jobs, ...second.jobs].map(({ _id }) => String(_id))).size).toBe(14);
});

test.each([
  ['applied', ['Job 1']],
  ['active', ['Job 14', 'Job 10', 'Job 9', 'Job 8', 'Job 7', 'Job 3', 'Job 2']],
  ['completed', ['Job 11', 'Job 4']],
  ['cancelled', ['Job 13', 'Job 12', 'Job 6', 'Job 5']],
])('filters %s across all jobs and sorts by deadline', async (view, titles) => {
  const result = await jobService.getMyJobs(customer, { view, sort: 'deadline' });
  expect(result.total).toBe(titles.length);
  expect(result.jobs.map(({ title }) => title)).toEqual(titles);
});

test('returns empty groups for an account with no jobs', async () => {
  const result = await jobService.getMyJobs(new mongoose.Types.ObjectId(), { view: 'all' });
  expect(result).toEqual({ jobs: [], counts: { all: 0, active: 0, applied: 0, completed: 0, cancelled: 0 }, total: 0, page: 1, pages: 0 });
});
