-- iCal (.ics) 取り込み用に source_type へ 'ical' を追加
alter type event_source add value if not exists 'ical';
