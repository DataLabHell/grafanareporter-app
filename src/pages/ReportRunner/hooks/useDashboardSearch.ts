/*
 * Copyright 2025 DatalabHell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getBackendSrv } from '@grafana/runtime';
import { useEffect, useState } from 'react';
import { DashboardSearchHit } from '../types';

/**
 * Fetches the list of dashboards the current user can access, for the dashboard picker.
 */
export const useDashboardSearch = () => {
  const [dashboards, setDashboards] = useState<DashboardSearchHit[]>([]);
  const [dashboardsError, setDashboardsError] = useState<string>();
  const [isFetchingDashboards, setIsFetchingDashboards] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const fetchDashboards = async () => {
      setIsFetchingDashboards(true);
      setDashboardsError(undefined);
      try {
        const response = await getBackendSrv().get<DashboardSearchHit[]>('/api/search', {
          type: 'dash-db',
          limit: 500,
        });
        if (mounted) {
          setDashboards(response);
        }
      } catch (err) {
        if (mounted) {
          setDashboardsError('Failed to load dashboards. Refresh the page or check your permissions.');
        }
      } finally {
        if (mounted) {
          setIsFetchingDashboards(false);
        }
      }
    };

    fetchDashboards();

    return () => {
      mounted = false;
    };
  }, []);

  return { dashboards, dashboardsError, isFetchingDashboards };
};
