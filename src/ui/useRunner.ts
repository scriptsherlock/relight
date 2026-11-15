import { useEffect, useState } from 'react';
import { getRunner, type RunnerStatus } from '../python/runner';

export function useRunnerStatus(): RunnerStatus {
  const [s, setS] = useState<RunnerStatus>(getRunner().status);
  useEffect(() => getRunner().onStatus(setS), []);
  return s;
}
