export { OfficeBackground } from './OfficeBackground';
export { ClassroomBackground } from './ClassroomBackground';
export { ConferenceBackground } from './ConferenceBackground';
export { WeddingBackground } from './WeddingBackground';
export { InterviewBackground } from './InterviewBackground';
export { GeneralBackground } from './GeneralBackground';

import { OfficeBackground } from './OfficeBackground';
import { ClassroomBackground } from './ClassroomBackground';
import { ConferenceBackground } from './ConferenceBackground';
import { WeddingBackground } from './WeddingBackground';
import { InterviewBackground } from './InterviewBackground';
import { GeneralBackground } from './GeneralBackground';
import type { Environment } from '../types';

interface EnvironmentBackgroundProps {
  environment: Environment;
}

export const EnvironmentBackground = ({ environment }: EnvironmentBackgroundProps) => {
  switch (environment) {
    case 'office_meeting':
      return <OfficeBackground />;
    case 'school_presentation':
      return <ClassroomBackground />;
    case 'conference':
      return <ConferenceBackground />;
    case 'wedding':
      return <WeddingBackground />;
    case 'interview':
      return <InterviewBackground />;
    case 'general':
    default:
      return <GeneralBackground />;
  }
};
