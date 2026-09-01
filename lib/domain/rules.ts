import type {
  ExistingBooking,
  ValidationResult,
  Venue,
  VenueApplication,
} from './types';

function overlaps(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
) {
  return startA < endB && endA > startB;
}

export function validateVenueApplication(
  application: VenueApplication,
  venue: Venue | undefined,
  bookings: ExistingBooking[] = [],
): ValidationResult {
  const start = new Date(application.startTime);
  const end = new Date(application.endTime);
  const requiredFields = [
    application.activityName,
    application.organization,
    application.venueId,
    application.description,
    application.contactName,
    application.contactPhone,
  ];
  const complete = requiredFields.every((value) => value.trim().length > 0);
  const validDates =
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end > start;
  const capacityPassed = Boolean(
    venue && application.attendees > 0 && application.attendees <= venue.capacity,
  );
  const equipmentPassed = Boolean(
    venue &&
      application.equipment.every((item) => venue.equipment.includes(item)),
  );
  const conflictingBooking = validDates
    ? bookings.find(
        (booking) =>
          booking.venueId === application.venueId &&
          overlaps(
            start,
            end,
            new Date(booking.startTime),
            new Date(booking.endTime),
          ),
      )
    : undefined;

  const results = [
    {
      ruleId: 'VENUE-REQ-001',
      label: '必填字段完整',
      passed: complete,
      message: complete ? '必填字段齐全。' : '请补充活动、组织、场地、说明和联系人信息。',
      evidenceRefs: ['FORM-SCHEMA-1.2'],
    },
    {
      ruleId: 'VENUE-TIME-001',
      label: '时间顺序有效',
      passed: validDates,
      message: validDates ? '结束时间晚于开始时间。' : '结束时间必须晚于开始时间。',
      evidenceRefs: ['FORM:startTime', 'FORM:endTime'],
    },
    {
      ruleId: 'VENUE-CAP-001',
      label: '场地容量充足',
      passed: capacityPassed,
      message: venue
        ? capacityPassed
          ? `预计 ${application.attendees} 人，不超过场地容量 ${venue.capacity} 人。`
          : `预计 ${application.attendees} 人，超过场地容量 ${venue.capacity} 人。`
        : '未找到有效场地。',
      evidenceRefs: venue
        ? [`FORM:attendees`, `VENUE:${venue.id}:capacity`]
        : ['FORM:venueId'],
    },
    {
      ruleId: 'VENUE-SLOT-001',
      label: '申请时段无冲突',
      passed: validDates && !conflictingBooking,
      message: !validDates
        ? '时间格式无效，无法检查冲突。'
        : conflictingBooking
          ? `与“${conflictingBooking.title}”的已占用时段冲突。`
          : '当前时段未发现冲突。',
      evidenceRefs: conflictingBooking
        ? ['FORM:startTime', 'FORM:endTime', `BOOKING:${conflictingBooking.title}`]
        : ['FORM:startTime', 'FORM:endTime'],
    },
    {
      ruleId: 'VENUE-EQP-001',
      label: '设备需求可满足',
      passed: equipmentPassed,
      message: venue
        ? equipmentPassed
          ? '所选场地可提供全部申请设备。'
          : '所选场地无法提供全部申请设备。'
        : '未找到有效场地。',
      evidenceRefs: venue ? [`VENUE:${venue.id}:equipment`] : ['FORM:venueId'],
    },
  ];

  return {
    passed: results.every((result) => result.passed),
    results,
  };
}

