const User = require('../models/User');
const TechnicianJob = require('../models/TechnicianJob');
const TechnicianJobRequest = require('../models/TechnicianJobRequest');
const TechnicianWithdrawal = require('../models/TechnicianWithdrawal');

/**
 * Haversine formula — returns distance in metres between two GPS coordinates.
 * Returns null if any coordinate is missing or invalid.
 */
const haversineMeters = (lat1, lng1, lat2, lng2) => {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return null;
  }

  const R = 6_371_000;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return Math.round(
    R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
};

/**
 * Convert date to YYYY-MM-DD using India timezone.
 */
const toYMD = (dt) => {
  if (!dt) return null;

  const d = new Date(dt);

  if (isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

/**
 * Get start of a date in India timezone.
 *
 * Example:
 * 2026-09-08
 * => 2026-09-07T18:30:00.000Z
 */
const startOfIndiaDate = (dateString) => {
  return new Date(`${dateString}T00:00:00+05:30`);
};

/**
 * Get end of a date in India timezone.
 *
 * Example:
 * 2026-09-08
 * => 2026-09-08T18:29:59.999Z
 */
const endOfIndiaDate = (dateString) => {
  return new Date(`${dateString}T23:59:59.999+05:30`);
};

/**
 * Check whether a jobDate window overlaps a selected date/range.
 *
 * Job:
 *   jobDate.from
 *   jobDate.to
 *
 * Selected range:
 *   fromDate
 *   toDate
 *
 * Overlap condition:
 *
 * jobFrom <= rangeTo
 * AND
 * jobTo >= rangeFrom
 *
 * This means:
 *
 * Job: Sep 8 12:00 -> Sep 8 14:00
 * Today: Sep 8
 * => TRUE
 *
 * Job: Sep 8 -> Sep 10
 * Today: Sep 9
 * => TRUE
 *
 * Job: Sep 8 -> Sep 10
 * Custom: Sep 9 -> Sep 12
 * => TRUE
 */
const isJobDateInRange = (job, fromDate, toDate) => {
  if (!job?.jobDate?.from || !job?.jobDate?.to) {
    return false;
  }

  const jobFrom = new Date(job.jobDate.from);
  const jobTo = new Date(job.jobDate.to);

  if (
    isNaN(jobFrom.getTime()) ||
    isNaN(jobTo.getTime())
  ) {
    return false;
  }

  const rangeFrom = startOfIndiaDate(fromDate);
  const rangeTo = endOfIndiaDate(toDate);

  if (
    isNaN(rangeFrom.getTime()) ||
    isNaN(rangeTo.getTime())
  ) {
    return false;
  }

  return jobFrom <= rangeTo && jobTo >= rangeFrom;
};

/**
 * Sort jobs by jobDate.from.
 */
const sortJobsByJobDate = (jobs) => {
  return jobs.sort((a, b) => {
    const aDate = new Date(a.jobDate?.from || 0).getTime();
    const bDate = new Date(b.jobDate?.from || 0).getTime();

    return aDate - bDate;
  });
};


// ─── GET JOBS FOR TECHNICIANS ────────────────────────────────────────────────

const getJobsForTechnicians = async (req, res, next) => {
  try {
    const {
      filter = 'new',
      fromDate,
      toDate,
    } = req.query;

    const techId = req.user._id;

    let jobs = [];

    // --------------------------------
    // NEW
    // --------------------------------
    if (filter === 'new') {
      jobs = await TechnicianJob.find({
        status: 'open',
        requestedBy: {
          $nin: [techId],
        },
      }).sort('-createdAt');
    }

    // --------------------------------
    // REQUESTED
    // --------------------------------
    else if (filter === 'requested') {
      jobs = await TechnicianJob.find({
        requestedBy: techId,
      }).sort('-updatedAt');
    }

    // --------------------------------
    // ACTIVE
    // --------------------------------
    else if (filter === 'active') {
      jobs = await TechnicianJob.find({
        'assignedTechnician._id': techId,
        status: {
          $in: [
            'assigned',
            'visited',
            'inprogress',
          ],
        },
        completedAt: null,
      }).sort('-createdAt');
    }

    // --------------------------------
    // COMPLETED
    // --------------------------------
    else if (filter === 'completed') {
      jobs = await TechnicianJob.find({
        'assignedTechnician._id': techId,
        $or: [
          {
            status: 'completed',
          },
          {
            completedAt: {
              $ne: null,
            },
          },
        ],
      }).sort('-completedAt');
    }

    // --------------------------------
    // TODAY
    // --------------------------------
    else if (filter === 'today') {
      const today = toYMD(new Date());

      const candidates = await TechnicianJob.find({
        status: {
          $in: [
            'assigned',
            'inprogress',
            'ontheway'
          ],
        },

        'assignedTechnician._id': techId,

        'jobDate.from': {
          $ne: null,
        },

        'jobDate.to': {
          $ne: null,
        },
      });

      jobs = candidates.filter((job) =>
        isJobDateInRange(
          job,
          today,
          today
        )
      );

      jobs = sortJobsByJobDate(jobs);
    }

    // --------------------------------
    // TOMORROW
    // --------------------------------
    else if (filter === 'tomorrow') {
      const tomorrowDate = new Date();

      tomorrowDate.setDate(
        tomorrowDate.getDate() + 1
      );

      const tomorrow = toYMD(
        tomorrowDate
      );

      const candidates = await TechnicianJob.find({
        status: {
          $in: [
            'assigned',
            'inprogress',
          ],
        },

        'assignedTechnician._id': techId,

        'jobDate.from': {
          $ne: null,
        },

        'jobDate.to': {
          $ne: null,
        },
      });

      jobs = candidates.filter((job) =>
        isJobDateInRange(
          job,
          tomorrow,
          tomorrow
        )
      );

      jobs = sortJobsByJobDate(jobs);
    }

    // --------------------------------
    // CUSTOM DATE RANGE
    // --------------------------------
    else if (filter === 'custom') {
      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          message:
            'fromDate and toDate are required for custom filter',
        });
      }

      /**
       * Accept:
       *
       * 2026-09-08
       *
       * or:
       *
       * 2026-09-08T12:00:00.000Z
       *
       * Only the date portion is used.
       */
      const from = String(fromDate)
        .split('T')[0];

      const to = String(toDate)
        .split('T')[0];

      /**
       * Validate YYYY-MM-DD.
       */
      const dateRegex =
        /^\d{4}-\d{2}-\d{2}$/;

      if (
        !dateRegex.test(from) ||
        !dateRegex.test(to)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid date format. Use YYYY-MM-DD',
        });
      }

      const rangeFrom =
        startOfIndiaDate(from);

      const rangeTo =
        endOfIndiaDate(to);

      if (
        isNaN(rangeFrom.getTime()) ||
        isNaN(rangeTo.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date range',
        });
      }

      if (rangeFrom > rangeTo) {
        return res.status(400).json({
          success: false,
          message:
            'fromDate cannot be greater than toDate',
        });
      }

      const candidates = await TechnicianJob.find({
        status: {
          $in: [
            'assigned',
            'inprogress',
          ],
        },

        'assignedTechnician._id': techId,

        'jobDate.from': {
          $ne: null,
        },

        'jobDate.to': {
          $ne: null,
        },
      });

      jobs = candidates.filter((job) =>
        isJobDateInRange(
          job,
          from,
          to
        )
      );

      jobs = sortJobsByJobDate(jobs);
    }

    // --------------------------------
    // INVALID FILTER
    // --------------------------------
    else {
      return res.status(400).json({
        success: false,
        message:
          'Invalid filter. Use: new, requested, active, completed, today, tomorrow, custom',
      });
    }

    // --------------------------------
    // GET REQUESTS
    // --------------------------------

    const jobIds = jobs.map(
      (job) => job._id
    );

    const requests =
      await TechnicianJobRequest.find({
        job: {
          $in: jobIds,
        },

        technician: techId,
      }).select(
        '_id job status'
      );

    // --------------------------------
    // GROUP REQUEST DATA BY JOB
    // --------------------------------

    const reqByJob = {};

    requests.forEach((r) => {
      reqByJob[
        r.job.toString()
      ] = {
        requestId:
          r._id.toString(),

        status:
          r.status,
      };
    });

    // --------------------------------
    // ADD REQUEST DATA
    // --------------------------------

    const jobsWithRequests =
      jobs.map((job) => {
        const obj =
          job.toObject();

        const request =
          reqByJob[
            job._id.toString()
          ];

        obj.requestId =
          request?.requestId ||
          null;

        obj.requestStatus =
          request?.status ||
          null;

        return obj;
      });

    // --------------------------------
    // RESPONSE
    // --------------------------------

    return res.status(200).json({
      success: true,

      data: {
        jobs: jobsWithRequests,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── REQUEST A JOB ───────────────────────────────────────────────────────────

const requestJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const note =
      req.body?.note;

    const fixedPrice =
      req.body?.fixedPrice;

    const charges =
      req.body?.charges;

    const job =
      await TechnicianJob.findById(
        jobId
      );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (job.status !== 'open') {
      return res.status(400).json({
        success: false,
        message:
          'This job is no longer open for requests',
      });
    }

    const existingRequest =
      await TechnicianJobRequest.findOne({
        job: jobId,

        technician:
          req.user._id,

        status: {
          $in: [
            'pending',
            'accepted',
            'counter-offer',
          ],
        },
      });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message:
          'You already requested this job',
      });
    }

    const hasBid =
      fixedPrice &&
      Number(fixedPrice) > 0;

    const bidAmount =
      hasBid
        ? Number(fixedPrice)
        : null;

    const now =
      new Date();

    // --------------------------------
    // BUILD OPENING MESSAGE
    // --------------------------------

    const schedDate =
      job.jobDate?.from
        ? new Date(
            job.jobDate.from
          )
        : null;

    const schedText =
      schedDate
        ? schedDate.toLocaleString(
            'en-IN',
            {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }
          )
        : 'scheduled time';

    const jobInfo =
      job.title ||
      `Job #${job._id}`;

    const openingEntry =
      note?.trim()
        ? {
            sender: 'technician',
            type: 'message',
            message:
              note.trim(),
            createdAt: now,
          }
        : {
            sender: 'technician',
            type: 'message',
            message:
              `Requested for ${jobInfo} on ${schedText}.`,
            createdAt: now,
          };

    const initialConversation = [
      openingEntry,
    ];

    // --------------------------------
    // FIXED PRICE
    // --------------------------------

    if (hasBid) {
      initialConversation.push({
        sender: 'technician',
        type: 'fixed_charge',

        message:
          `Proposed fixed price: $${bidAmount}`,

        fixedCharge:
          bidAmount,

        counterOffer:
          bidAmount,

        counterOfferFrom:
          'technician',

        createdAt: now,
      });
    }

    // --------------------------------
    // VALIDATE ADDITIONAL CHARGES
    // --------------------------------

    const hasCharges =
      Array.isArray(charges) &&
      charges.length > 0;

    if (hasCharges) {
      for (const c of charges) {
        if (!c.label?.trim()) {
          return res.status(400).json({
            success: false,
            message:
              'Each charge must have a label',
          });
        }

        if (
          !c.amount ||
          Number(c.amount) <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Amount for "${c.label}" must be > 0`,
          });
        }
      }
    }

    // --------------------------------
    // REQUEST DATA
    // --------------------------------

    const requestData = {
      job: jobId,

      technician:
        req.user._id,

      note:
        note?.trim() || '',

      status:
        'pending',

      counterOffer:
        hasBid
          ? bidAmount
          : 0,

      counterOfferFrom:
        hasBid
          ? 'technician'
          : '',

      conversation:
        initialConversation,

      ...(hasCharges && {
        chargesStatus:
          'pending',
      }),
    };

    if (hasBid) {
      requestData.bidAmount =
        bidAmount;
    }

    const request =
      await TechnicianJobRequest.create(
        requestData
      );

    // --------------------------------
    // ADD TECHNICIAN TO REQUESTED BY
    // --------------------------------

    await TechnicianJob.findByIdAndUpdate(
      jobId,
      {
        $addToSet: {
          requestedBy:
            req.user._id,
        },
      }
    );

    // --------------------------------
    // ADDITIONAL CHARGES
    // --------------------------------

    let createdCharges = [];

    if (hasCharges) {
      const AdditionalCharge =
        require(
          '../models/AdditionalCharge'
        );

      const chargeDocs =
        charges.map((c) => {
          const amt =
            Number(c.amount);

          return {
            job: jobId,

            request:
              request._id,

            technician:
              req.user._id,

            label:
              c.label.trim(),

            description:
              c.description?.trim() ||
              '',

            requestedAmount:
              amt,

            status:
              'pending',

            pendingWith:
              'admin',

            submittedAt:
              now,

            counterHistory: [
              {
                round: 1,

                actor:
                  'technician',

                action:
                  'submit',

                amount:
                  amt,

                note:
                  c.description?.trim() ||
                  '',

                createdAt:
                  now,
              },
            ],
          };
        });

      createdCharges =
        await AdditionalCharge.insertMany(
          chargeDocs
        );

      await TechnicianJobRequest.findByIdAndUpdate(
        request._id,
        {
          $push: {
            conversation: {
              sender:
                'technician',

              type:
                'charge_submitted',

              message:
                `Submitted ${createdCharges.length} additional charge(s) for admin review.`,

              charges:
                createdCharges.map(
                  (ch) => ({
                    chargeId:
                      ch._id,

                    label:
                      ch.label,

                    description:
                      ch.description,

                    amount:
                      ch.requestedAmount,
                  })
                ),

              createdAt:
                now,
            },
          },
        }
      );
    }

    // --------------------------------
    // SOCKET
    // --------------------------------

    try {
      const {
        getIO,
      } = require(
        '../utils/socketInstance'
      );

      getIO()
        .to('admin')
        .emit(
          'job:request:new',
          {
            jobId,
            request,
            charges:
              createdCharges,
          }
        );

    } catch (e) {
      console.warn(
        '[Socket] job:request:new emit failed:',
        e.message
      );
    }

    // --------------------------------
    // RESPONSE MESSAGE
    // --------------------------------

    const msg =
      hasCharges
        ? `Job request sent with ${createdCharges.length} additional charge(s)${
            hasBid
              ? ` and a fixed price of $${bidAmount}`
              : ''
          }`
        : hasBid
          ? `Job request sent with a proposed price of $${bidAmount}`
          : 'Job request sent';

    res.status(201).json({
      success: true,

      message: msg,

      data: {
        request,
        charges:
          createdCharges,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── MY REQUESTS ─────────────────────────────────────────────────────────────

const getMyRequests = async (
  req,
  res,
  next
) => {
  try {
    const requests =
      await TechnicianJobRequest.find({
        technician:
          req.user._id,
      })
        .populate('job')
        .sort('-createdAt');

    res.status(200).json({
      success: true,

      data: {
        requests,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── DASHBOARD ───────────────────────────────────────────────────────────────

const getTechnicianDashboard = async (
  req,
  res,
  next
) => {
  try {
    const technician =
      await User.findById(
        req.user._id
      );

    const withdrawals =
      await TechnicianWithdrawal.find({
        technician:
          req.user._id,
      }).sort('-createdAt');

    const totalEarnings =
      technician.totalEarnings || 0;

    const totalWithdrawn =
      technician.totalWithdrawn || 0;

    res.status(200).json({
      success: true,

      data: {
        technician: {
          name:
            technician.name,

          email:
            technician.email,

          phone:
            technician.phone,

          skills:
            technician.skills || [],

          experienceLevel:
            technician.experienceLevel ||
            'Beginner',

          totalJobsDone:
            technician.totalJobsDone ||
            0,

          totalEarnings,

          totalWithdrawn,

          availableBalance:
            Math.max(
              totalEarnings -
                totalWithdrawn,
              0
            ),

          profileCompleted:
            technician.profileCompleted ||
            false,
        },

        withdrawals,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── CONVERSATION HELPERS ─────────────────────────────────────────────────────

const formatConvEntry = (
  entry
) => {
  const base = {
    _id:
      entry._id,

    sender:
      entry.sender,

    type:
      entry.type ||
      'message',

    message:
      entry.message,

    createdAt:
      entry.createdAt,
  };

  switch (entry.type) {
    case 'fixed_charge':
      return {
        ...base,

        fixedCharge:
          entry.fixedCharge,

        counterOfferFrom:
          entry.counterOfferFrom,
      };

    case 'charge_submitted':
      return {
        ...base,

        charges:
          entry.charges ||
          [],
      };

    case 'charge_reviewed':
    case 'charge_responded':
      return {
        ...base,

        chargeId:
          entry.chargeId,

        chargeLabel:
          entry.chargeLabel,

        action:
          entry.action,

        amount:
          entry.amount,

        note:
          entry.note,
      };

    case 'final_amount':
    case 'invoice_generated':
      return {
        ...base,

        fixedJobCharge:
          entry.fixedJobCharge,

        additionalChargesTotal:
          entry.additionalChargesTotal,

        finalAmount:
          entry.finalAmount,
      };

    default:
      return base;
  }
};


// ─── GET REQUEST CONVERSATION ────────────────────────────────────────────────

const getRequestConversation = async (
  req,
  res,
  next
) => {
  try {
    const {
      requestId,
    } = req.params;

    const request =
      await TechnicianJobRequest.findById(
        requestId
      )
        .populate(
          'job',
          'title location pay status'
        )
        .select(
          'conversation status chargesStatus finalJobAmount agreedTotal agreedFixedCharge agreedAdditionalTotal technician job'
        );

    if (!request) {
      return res.status(404).json({
        success: false,
        message:
          'Request not found',
      });
    }

    const isOwner =
      request.technician.toString() ===
      req.user._id.toString();

    const isAdmin =
      req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message:
          'Not authorised',
      });
    }

    const conversation =
      (
        request.conversation ||
        []
      ).map(formatConvEntry);

    return res.status(200).json({
      success: true,

      data: {
        requestId:
          request._id,

        status:
          request.status,

        chargesStatus:
          request.chargesStatus,

        finalJobAmount:
          request.finalJobAmount ||
          null,

        agreedTotal:
          request.agreedTotal ||
          null,

        job:
          request.job,

        conversation,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── WITHDRAWAL ───────────────────────────────────────────────────────────────

const createWithdrawalRequest = async (
  req,
  res,
  next
) => {
  try {
    const {
      amount,
      method,
      details,
    } = req.body;

    const technician =
      await User.findById(
        req.user._id
      );

    const available =
      Math.max(
        (technician.totalEarnings || 0) -
          (technician.totalWithdrawn || 0),
        0
      );

    if (
      !amount ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Please provide a valid withdrawal amount',
      });
    }

    if (amount > available) {
      return res.status(400).json({
        success: false,
        message:
          'Withdrawal amount exceeds available balance',
      });
    }

    const withdrawal =
      await TechnicianWithdrawal.create({
        technician:
          req.user._id,

        amount,

        method:
          method ||
          'bank-transfer',

        details:
          details || '',

        status:
          'pending',
      });

    res.status(201).json({
      success: true,

      message:
        'Withdrawal requested',

      data: {
        withdrawal,
      },
    });

  } catch (error) {
    next(error);
  }
};


const getWithdrawals = async (
  req,
  res,
  next
) => {
  try {
    const withdrawals =
      await TechnicianWithdrawal.find({
        technician:
          req.user._id,
      }).sort('-createdAt');

    res.status(200).json({
      success: true,

      data: {
        withdrawals,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── MESSAGING ───────────────────────────────────────────────────────────────

const sendMessageOnRequest = async (
  req,
  res,
  next
) => {
  try {
    const {
      requestId,
    } = req.params;

    const {
      message,
    } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          'Message is required',
      });
    }

    const request =
      await TechnicianJobRequest.findById(
        requestId
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message:
          'Request not found',
      });
    }

    if (
      request.technician.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Not allowed',
      });
    }

    const entry = {
      sender:
        'technician',

      type:
        'message',

      message:
        message.trim(),

      createdAt:
        new Date(),
    };

    request.conversation =
      request.conversation ||
      [];

    request.conversation.push(
      entry
    );

    await request.save();

    // --------------------------------
    // SOCKET
    // --------------------------------

    try {
      const {
        getIO,
      } = require(
        '../utils/socketInstance'
      );

      getIO()
        .to(
          `request:${requestId}`
        )
        .emit(
          'request:message',
          {
            requestId,
            message:
              entry,
          }
        );

    } catch (e) {
      console.warn(
        '[Socket] request:message emit failed:',
        e.message
      );
    }

    res.status(200).json({
      success: true,

      message:
        'Message sent',

      data: {
        entry,
      },
    });

  } catch (error) {
    next(error);
  }
};


const getRequestMessages = async (
  req,
  res,
  next
) => {
  try {
    const {
      requestId,
    } = req.params;

    const request =
      await TechnicianJobRequest.findById(
        requestId
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message:
          'Request not found',
      });
    }

    if (
      request.technician.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Not allowed',
      });
    }

    res.status(200).json({
      success: true,

      data: {
        conversation:
          request.conversation ||
          [],
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── CANCEL REQUEST ───────────────────────────────────────────────────────────

const cancelJobRequest = async (
  req,
  res,
  next
) => {
  try {
    const {
      requestId,
    } = req.params;

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message:
          'Authentication required',
      });
    }

    const request =
      await TechnicianJobRequest.findById(
        requestId
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message:
          'Request not found',
      });
    }

    if (
      request.technician.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not allowed to cancel this request',
      });
    }

    if (
      ![
        'pending',
        'counter-offer',
      ].includes(
        request.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Request cannot be cancelled in status "${request.status}"`,
      });
    }

    const jobId =
      request.job;

    await TechnicianJobRequest.findByIdAndDelete(
      requestId
    );

    await TechnicianJob.findByIdAndUpdate(
      jobId,
      {
        $pull: {
          requestedBy:
            req.user._id,
        },
      }
    );

    // --------------------------------
    // SOCKET
    // --------------------------------

    try {
      const {
        getIO,
      } = require(
        '../utils/socketInstance'
      );

      getIO()
        .to('admin')
        .emit(
          'job:request:cancelled',
          {
            requestId,
            jobId,
            technicianId:
              req.user._id,
          }
        );

    } catch (e) {
      console.warn(
        '[Socket] cancelJobRequest emit failed:',
        e.message
      );
    }

    return res.status(200).json({
      success: true,

      message:
        'Job request cancelled',

      data: {
        requestId,
        jobId,

        technicianId:
          req.user._id,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── UPDATE REQUEST STATUS ────────────────────────────────────────────────────

const updateRequestStatus = async (
  req,
  res,
  next
) => {
  try {
    const {
      requestId,
    } = req.params;

    const {
      status,
      adminMessage,
      counterOffer,
    } = req.body;

    const request =
      await TechnicianJobRequest.findById(
        requestId
      ).populate(
        'technician job'
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message:
          'Request not found',
      });
    }

    const allowed = [
      'accepted',
      'rejected',
      'counter-offer',
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid status update',
      });
    }

    request.status =
      status;

    if (adminMessage) {
      request.adminMessage =
        adminMessage;
    }

    if (
      counterOffer !==
      undefined
    ) {
      request.counterOffer =
        Number(
          counterOffer || 0
        );
    }

    // --------------------------------
    // ACCEPTED
    // --------------------------------

    if (status === 'accepted') {
      request.completedAt =
        new Date();

      const technician =
        await User.findById(
          request.technician
        );

      // --------------------------------
      // DERIVE PAY FROM JOB
      // --------------------------------

      const p =
        request.job?.pay ||
        {};

      let payValue = 0;

      switch (p.type) {
        case 'fixed':
          payValue =
            p.fixedAmount ||
            0;
          break;

        case 'hourly':
          payValue =
            (p.hourlyRate || 0) *
            (p.maxHours || 0);
          break;

        case 'perDevice':
          payValue =
            (p.perDeviceRate || 0) *
            (p.maxDevices || 0);
          break;

        case 'blended':
          payValue =
            (p.blendedFixedAmount || 0) +
            (p.blendedHourlyRate || 0) *
              (p.blendedMaxAddlHours || 0);
          break;
      }

      technician.totalEarnings =
        (technician.totalEarnings || 0) +
        payValue;

      technician.totalJobsDone =
        (technician.totalJobsDone || 0) +
        1;

      await technician.save();
    }

    await request.save();

    res.status(200).json({
      success: true,

      message:
        'Request updated',

      data: {
        request,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── METRICS ─────────────────────────────────────────────────────────────────

const getMetrics = async (
  req,
  res,
  next
) => {
  try {
    const technician =
      await User.findById(
        req.user._id
      );

    const requests =
      await TechnicianJobRequest.find({
        technician:
          req.user._id,
      })
        .populate('job')
        .sort({
          createdAt: -1,
        });

    const acceptedCount =
      requests.filter(
        (r) =>
          r.status ===
          'accepted'
      ).length;

    const pendingCount =
      requests.filter(
        (r) =>
          r.status ===
          'pending'
      ).length;

    const totalRequests =
      requests.length;

    // --------------------------------
    // MY ACCEPTED JOBS
    // --------------------------------

    const myJobs =
      requests
        .filter(
          (r) =>
            r.status ===
              'accepted' &&
            r.job
        )
        .map(
          (r) => r.job
        );

    // --------------------------------
    // ACTIVE JOBS
    // --------------------------------

    const activeJobs =
      myJobs.filter(
        (j) =>
          j.status !==
            'completed' &&
          !j.completedAt
      ).length;

    // --------------------------------
    // TODAY'S SCHEDULE
    // USE jobDate.from / jobDate.to
    // --------------------------------

    const todayStr =
      toYMD(
        new Date()
      );

    const todaySchedule =
      myJobs.filter(
        (job) => {
          // Completed jobs should
          // not appear in today's
          // schedule.
          if (
            job.status ===
              'completed' ||
            job.completedAt
          ) {
            return false;
          }

          if (
            !job.jobDate?.from ||
            !job.jobDate?.to
          ) {
            return false;
          }

          return isJobDateInRange(
            job,
            todayStr,
            todayStr
          );
        }
      ).length;

    // --------------------------------
    // RESPONSE
    // --------------------------------

    return res.status(200).json({
      success: true,

      data: {
        metrics: {
          totalJobsDone:
            technician.totalJobsDone ||
            0,

          totalEarnings:
            technician.totalEarnings ||
            0,

          totalWithdrawn:
            technician.totalWithdrawn ||
            0,

          availableBalance:
            Math.max(
              (technician.totalEarnings || 0) -
                (technician.totalWithdrawn || 0),
              0
            ),

          acceptedCount,

          pendingCount,

          activeJobs,

          todaySchedule,

          totalRequests,
        },
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── START NAVIGATION ─────────────────────────────────────────────────────────

/**
 * PATCH /api/technician/jobs/:jobId/start-navigation
 * Technician taps "Start Navigation" — sets job status to 'ontheway'.
 * Body: { lat?, lng? }
 */
const startNavigation = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { lat, lng } = req.body || {};

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (
      !job.assignedTechnician?._id ||
      job.assignedTechnician._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this job' });
    }

    if (!['assigned'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot start navigation when job status is "${job.status}"`,
      });
    }

    const now = new Date();
    job.status = 'ontheway';

    job.statusHistory = job.statusHistory || [];
    job.statusHistory.push({ status: 'ontheway', note: 'Technician started navigation', changedAt: now });

    job.conversation = job.conversation || [];
    job.conversation.push({
      sender: 'technician',
      message: `Technician is on the way${
        lat != null && lng != null
          ? ` (GPS: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)})`
          : ''
      } at ${now.toLocaleString('en-IN')}.`,
      createdAt: now,
    });

    await job.save();

    try {
      const { getIO } = require('../utils/socketInstance');
      getIO().to('admin').emit('job:updated', { job });
    } catch (e) {
      console.warn('[Socket] job:updated emit failed in startNavigation:', e.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Navigation started. Job status set to On The Way.',
      data: { status: job.status, jobId: job._id },
    });
  } catch (error) {
    next(error);
  }
};


// ─── MARK REACHED ─────────────────────────────────────────────────────────────

const markReached = async (
  req,
  res,
  next
) => {
  try {
    const {
      jobId,
    } = req.params;

    const {
      lat,
      lng,
    } = req.body || {};

    const job =
      await TechnicianJob.findById(
        jobId
      );

    if (!job) {
      return res.status(404).json({
        success: false,
        message:
          'Job not found',
      });
    }

    if (
      !job.assignedTechnician?._id ||
      job.assignedTechnician._id.toString() !==
        req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not assigned to this job',
      });
    }

    if (job.reachedAt) {
      return res.status(400).json({
        success: false,
        message:
          'Location already marked as reached',
      });
    }

    // Accept 'assigned', 'ontheway' (navigation started) or 'inprogress' as valid prior states
    if (!['assigned', 'ontheway', 'inprogress'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot mark reached when job status is "${job.status}"`,
      });
    }

    const now =
      new Date();

    job.reachedAt =
      now;

    job.jobStartedAt =
      now;

    job.status =
      'inprogress';

    // --------------------------------
    // LOCATION
    // --------------------------------

    const hasLocation =
      lat != null &&
      lng != null &&
      !isNaN(Number(lat)) &&
      !isNaN(Number(lng));

    const distMeters =
      hasLocation
        ? haversineMeters(
            Number(lat),
            Number(lng),
            job.coordinates?.lat,
            job.coordinates?.lng
          )
        : null;

    if (hasLocation) {
      job.reachedStatus = {
        at:
          now,

        lat:
          Number(lat),

        lng:
          Number(lng),

        distanceMeters:
          distMeters,
      };
    }

    const distNote =
      distMeters !== null
        ? ` Distance from job site: ${
            distMeters >= 1000
              ? (
                  distMeters / 1000
                ).toFixed(2) +
                ' km'
              : distMeters +
                ' m'
          }.`
        : '';

    const locationNote =
      hasLocation
        ? ` (GPS: ${Number(lat).toFixed(
            6
          )}, ${Number(lng).toFixed(
            6
          )})${distNote}`
        : '';

    // --------------------------------
    // CONVERSATION
    // --------------------------------

    job.conversation =
      job.conversation ||
      [];

    job.conversation.push({
      sender:
        'technician',

      message:
        `Technician reached the location at ${now.toLocaleString(
          'en-IN'
        )}.${locationNote}`,

      createdAt:
        now,
    });

    // ── Auto-complete the first incomplete "On Site" task ────────────────────
    const firstOnSiteIdx = job.tasks.findIndex(
      (t) => t.group === 'On Site' && !t.isDone
    );
    if (firstOnSiteIdx !== -1) {
      const t = job.tasks[firstOnSiteIdx];
      t.isDone         = true;
      t.checkedAt      = now;
      t.technicianLat  = hasLocation ? Number(lat) : null;
      t.technicianLng  = hasLocation ? Number(lng) : null;
      t.distanceMeters = distMeters;
      job.markModified('tasks');
    }

    await job.save();

    // Notify admin about the auto-completed On Site task
    if (firstOnSiteIdx !== -1) {
      try {
        const { getIO } = require('../utils/socketInstance');
        getIO().to('admin').emit('job:task:completed', {
          jobId,
          taskIndex: firstOnSiteIdx,
          task: job.tasks[firstOnSiteIdx],
        });
      } catch (e) {
        console.warn('[Socket] job:task:completed emit failed:', e.message);
      }
    }

    res.status(200).json({
      success: true,

      message:
        'Reached location recorded',

      data: {
        reachedAt:
          job.reachedAt,

        jobStartedAt:
          job.jobStartedAt,

        status:
          job.status,

        reachedStatus:
          job.reachedStatus,

        autoCompletedTaskIndex: firstOnSiteIdx !== -1 ? firstOnSiteIdx : null,
        autoCompletedTask:      firstOnSiteIdx !== -1 ? job.tasks[firstOnSiteIdx] : null,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── MARK JOB COMPLETED ───────────────────────────────────────────────────────

const markJobCompleted = async (
  req,
  res,
  next
) => {
  try {
    const {
      jobId,
    } = req.params;

    const {
      lat,
      lng,
    } = req.body || {};

    const job =
      await TechnicianJob.findById(
        jobId
      );

    if (!job) {
      return res.status(404).json({
        success: false,
        message:
          'Job not found',
      });
    }

    if (
      !job.assignedTechnician?._id ||
      job.assignedTechnician._id.toString() !==
        req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not assigned to this job',
      });
    }

    if (job.jobCompletedAt) {
      return res.status(400).json({
        success: false,
        message:
          'Job already marked as completed',
      });
    }

    const now =
      new Date();

    job.jobCompletedAt =
      now;

    // --------------------------------
    // JOB DURATION
    // --------------------------------

    const startRef =
      job.jobStartedAt ||
      job.reachedAt;

    if (startRef) {
      job.jobDurationMinutes =
        Math.round(
          (
            now -
            new Date(startRef)
          ) / 60000
        );
    }

    // --------------------------------
    // LOCATION
    // --------------------------------

    const hasLocation =
      lat != null &&
      lng != null &&
      !isNaN(Number(lat)) &&
      !isNaN(Number(lng));

    const distMeters =
      hasLocation
        ? haversineMeters(
            Number(lat),
            Number(lng),
            job.coordinates?.lat,
            job.coordinates?.lng
          )
        : null;

    if (hasLocation) {
      job.completedStatus = {
        at:
          now,

        lat:
          Number(lat),

        lng:
          Number(lng),

        distanceMeters:
          distMeters,
      };
    }

    const distNote =
      distMeters !== null
        ? ` Distance from job site: ${
            distMeters >= 1000
              ? (
                  distMeters / 1000
                ).toFixed(2) +
                ' km'
              : distMeters +
                ' m'
          }.`
        : '';

    const locationNote =
      hasLocation
        ? ` (GPS: ${Number(lat).toFixed(
            6
          )}, ${Number(lng).toFixed(
            6
          )})${distNote}`
        : '';

    // --------------------------------
    // CONVERSATION
    // --------------------------------

    job.conversation =
      job.conversation ||
      [];

    job.conversation.push({
      sender:
        'technician',

      message:
        `Technician marked job as completed at ${now.toLocaleString(
          'en-IN'
        )}.${
          job.jobDurationMinutes !=
          null
            ? ` Duration: ${job.jobDurationMinutes} min.`
            : ''
        }${locationNote}`,

      createdAt:
        now,
    });

    await job.save();

    res.status(200).json({
      success: true,

      message:
        'Job completion recorded. Waiting for admin to close and process payment.',

      data: {
        jobCompletedAt:
          job.jobCompletedAt,

        jobDurationMinutes:
          job.jobDurationMinutes,

        reachedAt:
          job.reachedAt,

        completedStatus:
          job.completedStatus,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── COMPLETE A TASK ──────────────────────────────────────────────────────────

const completeTask = async (
  req,
  res,
  next
) => {
  try {
    const {
      jobId,
      taskIndex,
    } = req.params;

    const {
      lat,
      lng,
    } = req.body || {};

    const job =
      await TechnicianJob.findById(
        jobId
      );

    if (!job) {
      return res.status(404).json({
        success: false,
        message:
          'Job not found',
      });
    }

    if (
      !job.assignedTechnician?._id ||
      job.assignedTechnician._id.toString() !==
        req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not assigned to this job',
      });
    }

    const idx =
      Number(taskIndex);

    if (
      isNaN(idx) ||
      idx < 0 ||
      idx >= job.tasks.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid task index',
      });
    }

    const task =
      job.tasks[idx];

    if (task.isDone) {
      return res.status(400).json({
        success: false,
        message:
          'Task already completed',
      });
    }

    // --------------------------------
    // LOCATION
    // --------------------------------

    const hasLocation =
      lat != null &&
      lng != null &&
      !isNaN(Number(lat)) &&
      !isNaN(Number(lng));

    const distMeters =
      hasLocation
        ? haversineMeters(
            Number(lat),
            Number(lng),
            job.coordinates?.lat,
            job.coordinates?.lng
          )
        : null;

    task.isDone =
      true;

    task.checkedAt =
      new Date();

    task.technicianLat =
      hasLocation
        ? Number(lat)
        : null;

    task.technicianLng =
      hasLocation
        ? Number(lng)
        : null;

    task.distanceMeters =
      distMeters;

    job.markModified(
      'tasks'
    );

    await job.save();

    // --------------------------------
    // SOCKET
    // --------------------------------

    try {
      const {
        getIO,
      } = require(
        '../utils/socketInstance'
      );

      getIO()
        .to('admin')
        .emit(
          'job:task:completed',
          {
            jobId,

            taskIndex:
              idx,

            task:
              job.tasks[idx],
          }
        );

    } catch (e) {
      console.warn(
        '[Socket] job:task:completed emit failed:',
        e.message
      );
    }

    return res.status(200).json({
      success: true,

      message:
        'Task marked as completed',

      data: {
        task:
          job.tasks[idx],
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── GET JOB DETAILS ──────────────────────────────────────────────────────────

const getDetailsByJobId = async (
  req,
  res,
  next
) => {
  try {
    const {
      jobId,
    } = req.params;

    const job =
      await TechnicianJob.findById(
        jobId
      ).populate(
        'assignedTechnician',
        'name email phone skills experienceLevel'
      );

    if (!job) {
      return res.status(404).json({
        success: false,
        message:
          'Job not found',
      });
    }

    return res.status(200).json({
      success: true,

      data: {
        job,
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  getJobsForTechnicians,
  requestJob,
  cancelJobRequest,
  getMyRequests,
  getTechnicianDashboard,
  createWithdrawalRequest,
  getWithdrawals,
  updateRequestStatus,
  getMetrics,
  startNavigation,
  markReached,
  markJobCompleted,
  sendMessageOnRequest,
  getRequestMessages,
  getRequestConversation,
  getDetailsByJobId,
  completeTask,
};