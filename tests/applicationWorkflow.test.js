jest.mock('../src/models/Application', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock('../src/models/Job', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../src/utils/cloudinaryUpload', () => jest.fn());

const mongoose = require('mongoose');
const Application = require('../src/models/Application');
const Job = require('../src/models/Job');
const ApplicationService = require('../src/services/applicationService');
const JobService = require('../src/services/jobService');

const asSessionQuery = (value) => ({
  session: jest.fn().mockResolvedValue(value),
});

describe('customer-to-worker application workflow', () => {
  let session;

  beforeEach(() => {
    jest.clearAllMocks();
    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('accepting a pending application assigns the open job and rejects other pending proposals atomically', async () => {
    const application = {
      _id: 'application-1',
      job: 'job-1',
      worker: 'provider-1',
      status: 'Pending',
    };
    const job = { _id: 'job-1', customer: 'customer-1', status: 'Open' };
    const acceptedApplication = { ...application, status: 'Accepted' };

    Application.findById.mockReturnValue(asSessionQuery(application));
    Job.findById.mockReturnValue(asSessionQuery(job));
    Job.findOneAndUpdate.mockResolvedValue({ ...job, status: 'Assigned', hiredProvider: 'provider-1' });
    Application.findOneAndUpdate.mockResolvedValue(acceptedApplication);
    Application.updateMany.mockResolvedValue({ modifiedCount: 1 });

    const result = await ApplicationService.acceptApplication('application-1', 'customer-1');

    expect(result.status).toBe('Accepted');
    expect(Job.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'job-1', customer: 'customer-1', status: 'Open' },
      { $set: { status: 'Assigned', hiredProvider: 'provider-1' } },
      expect.objectContaining({ session, new: true })
    );
    expect(Application.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'application-1', job: 'job-1', status: 'Pending' },
      { $set: { status: 'Accepted' } },
      expect.objectContaining({ session, new: true })
    );
    expect(Application.updateMany).toHaveBeenCalledWith(
      { job: 'job-1', _id: { $ne: 'application-1' }, status: 'Pending' },
      { $set: { status: 'Rejected' } },
      { session }
    );
    expect(session.endSession).toHaveBeenCalled();
  });

  test('customer job posting saves normalized location and service type', async () => {
    const createdJob = { _id: 'job-1', status: 'Open', customer: 'customer-1' };
    Job.create.mockResolvedValue(createdJob);

    const result = await JobService.createJob('customer-1', {
      title: 'House cleaning',
      description: 'Clean a two-bedroom apartment',
      category: 'House Cleaning',
      budget: '345',
      deadline: '2026-12-01',
      address: 'Mumbai',
      longitude: '72.8777',
      latitude: '19.0760',
      serviceType: 'local',
    });

    expect(result).toBe(createdJob);
    expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'customer-1',
      budget: '345',
      serviceType: 'local',
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.076],
        address: 'Mumbai',
      },
      images: [],
    }));
  });

  test('provider can apply to an open job and receives a pending application', async () => {
    const openJob = { _id: 'job-1', customer: 'customer-1', status: 'Open' };
    const pendingApplication = { _id: 'application-1', job: 'job-1', worker: 'provider-1', status: 'Pending' };
    Job.findById.mockResolvedValue(openJob);
    Application.findOne.mockResolvedValue(null);
    Application.create.mockResolvedValue(pendingApplication);

    const result = await ApplicationService.applyToJob('provider-1', {
      job: 'job-1',
      proposalMessage: 'I can do this job',
      bidAmount: '300',
      estimatedCompletionTime: '2 days',
    });

    expect(result.status).toBe('Pending');
    expect(Application.create).toHaveBeenCalledWith({
      job: 'job-1',
      worker: 'provider-1',
      proposalMessage: 'I can do this job',
      bidAmount: '300',
      estimatedCompletionTime: '2 days',
    });
  });

  test('duplicate apply is reported as a conflict even when the unique index wins a race', async () => {
    Job.findById.mockResolvedValue({ _id: 'job-1', customer: 'customer-1', status: 'Open' });
    Application.findOne.mockResolvedValue(null);
    Application.create.mockRejectedValue({ code: 11000 });

    await expect(ApplicationService.applyToJob('provider-1', {
      job: 'job-1',
      proposalMessage: 'I can do this job',
      bidAmount: 300,
      estimatedCompletionTime: '2 days',
    })).rejects.toThrow('already applied');
  });

  test('only the customer who owns the job can accept an application', async () => {
    Application.findById.mockReturnValue(asSessionQuery({
      _id: 'application-1', job: 'job-1', worker: 'provider-1', status: 'Pending',
    }));
    Job.findById.mockReturnValue(asSessionQuery({
      _id: 'job-1', customer: 'another-customer', status: 'Open',
    }));

    await expect(ApplicationService.acceptApplication('application-1', 'customer-1'))
      .rejects.toThrow('not authorized');
    expect(Job.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('an already assigned job cannot be assigned to a second provider', async () => {
    Application.findById.mockReturnValue(asSessionQuery({
      _id: 'application-2', job: 'job-1', worker: 'provider-2', status: 'Pending',
    }));
    Job.findById.mockReturnValue(asSessionQuery({
      _id: 'job-1', customer: 'customer-1', status: 'Open',
    }));
    Job.findOneAndUpdate.mockResolvedValue(null);

    await expect(ApplicationService.acceptApplication('application-2', 'customer-1'))
      .rejects.toThrow('already been assigned');
    expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Application.updateMany).not.toHaveBeenCalled();
  });

  test('worker job statuses include pending and accepted applications only', async () => {
    Application.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { job: 'job-pending', status: 'Pending' },
          { job: 'job-accepted', status: 'Accepted' },
        ]),
      }),
    });

    await expect(ApplicationService.getMyActiveApplicationStatuses('provider-1')).resolves.toEqual({
      'job-pending': 'Pending',
      'job-accepted': 'Accepted',
    });
    expect(Application.find).toHaveBeenCalledWith({
      worker: 'provider-1',
      status: { $in: ['Pending', 'Accepted'] },
    });
  });
});
