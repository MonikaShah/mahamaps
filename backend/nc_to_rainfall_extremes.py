import glob
import xarray as xr
import numpy as np
from shapely.geometry import box
import pandas as pd
import os

# Input years range
start_year = 1901
end_year = 1950

def extremes(start_year,end_year,bbox):

    index_df = pd.DataFrame()

    for year in range(start_year, end_year + 1):
        nc_file = f'data/RF25_ind{year}_rfp25.nc'
        if not os.path.exists(nc_file):
            print(f"Warning: {nc_file} not found. Skipping year {year}.")
            continue
        ds = xr.open_dataset(nc_file)

        bbox = bbox

        mask = ((ds.LONGITUDE >= bbox.bounds[0]) & (ds.LONGITUDE <= bbox.bounds[2]) & (ds.LATITUDE >= bbox.bounds[1]) & (ds.LATITUDE <= bbox.bounds[3]))
        masked_data = ds['RAINFALL'].where(mask, drop=True)

        daily_avg_rainfall = masked_data.mean(dim=['LONGITUDE', 'LATITUDE'], skipna=True)

        # Skip if all values are NaN
        if np.all(np.isnan(daily_avg_rainfall)):
            print(f"Info: All data is NaN for year {year} and selected region. Skipping.")
            ds.close()
            continue

        # Calculate other indices
        RX1day = daily_avg_rainfall.max()
        RX5day = daily_avg_rainfall.rolling(TIME=5).sum().max(skipna=True)
        R95p = daily_avg_rainfall.quantile(0.95, dim='TIME', skipna=True)
        R95p = daily_avg_rainfall.where(daily_avg_rainfall > R95p, 0).sum(dim='TIME')
        R99p = daily_avg_rainfall.quantile(0.99, dim='TIME', skipna=True)
        R99p = daily_avg_rainfall.where(daily_avg_rainfall > R99p, 0).sum(dim='TIME')
        R10mm = (daily_avg_rainfall >= 10).sum(skipna=True)
        R20mm = (daily_avg_rainfall >= 20).sum(skipna=True)
        R65mm = ((daily_avg_rainfall >= 65) & (daily_avg_rainfall < 115)).sum(skipna=True)
        R115mm = ((daily_avg_rainfall >= 115) & (daily_avg_rainfall < 205)).sum(skipna=True)
        R205mm = (daily_avg_rainfall >= 205).sum(skipna=True)
        dry_days = daily_avg_rainfall < 1
        if np.any(dry_days):
            diff_idx = np.where(np.diff(np.concatenate(([False], dry_days, [False]))))[0]
            dry_lengths = np.diff(diff_idx)[::2]
            CDD = np.max(dry_lengths)
        else:
            CDD = 0

        wet_days = daily_avg_rainfall >= 1
        if np.any(wet_days):
            diff_idx = np.where(np.diff(np.concatenate(([False], wet_days, [False]))))[0]
            wet_lengths = np.diff(diff_idx)[::2]
            CWD = np.max(wet_lengths)
        else:
            CWD = 0

        index_values = {
            'RX1day': RX1day.values.item(),
            'RX5day': RX5day.values.item(),
            'R95p': R95p.values.item(),
            'R99p': R99p.values.item(),
            'R10mm': R10mm.values.item(),
            'R20mm': R20mm.values.item(),
            'R65mm': R65mm.values.item(),
            'R115mm': R115mm.values.item(),
            'R205mm': R205mm.values.item(),
            'CDD': CDD,
            'CWD': CWD
        }

        index_df = pd.concat([index_df, pd.DataFrame(index_values, index=[year])])

        ds.close()

    csv_path = 'index_values.csv'
    # Write header if file does not exist or is empty
    write_header = not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0
    index_df.to_csv(csv_path, mode='a', header=write_header)
