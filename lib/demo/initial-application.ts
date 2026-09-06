import type { VenueApplication } from '@/lib/domain/types';

export const initialApplication: VenueApplication = {
  activityName: '2026 秋季社团招新宣讲会',
  organization: '学生创新协会',
  venueId: 'activity-center',
  attendees: 80,
  startTime: '2026-09-08T19:00:00+08:00',
  endTime: '2026-09-08T21:00:00+08:00',
  description:
    '面向全校新生介绍协会方向与年度计划，现场包含项目展示、成员分享和招新答疑。',
  contactName: '林同学',
  contactPhone: '13800000000',
  equipment: ['投影', '无线麦克风', '基础扩声'],
};
