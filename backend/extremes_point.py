import xarray as xr
import numpy as np
import pandas as pd
import os

def extremes_point(start_year, end_year, lon, lat):
    index_df = pd.DataFrame()
    for year in range(start_year, end_year + 1):
        nc_file = f'data/RF25_ind{year}_rfp25.nc'
        if not os.path.exists(nc_file):
            print(f"Warning: {nc_file} not found. Skipping year {year}.")
            continue
        ds = xr.open_dataset(nc_file)
        # Find nearest grid point
        abs_lon = np.abs(ds.LONGITUDE - lon)
        abs_lat = np.abs(ds.LATITUDE - lat)
        i = abs_lon.argmin().item()
        j = abs_lat.argmin().item()
        point_data = ds['RAINFALL'].isel(LONGITUDE=i, LATITUDE=j)
        # Skip if all values are NaN
        if np.all(np.isnan(point_data)):
            print(f"Info: All data is NaN for year {year} and selected point. Skipping.")
            ds.close()
            continue
        RX1day = point_data.max()
        RX5day = point_data.rolling(TIME=5).sum().max(skipna=True)
        R95p = point_data.quantile(0.95, dim='TIME', skipna=True)
        R95p = point_data.where(point_data > R95p, 0).sum(dim='TIME')
        R99p = point_data.quantile(0.99, dim='TIME', skipna=True)
        R99p = point_data.where(point_data > R99p, 0).sum(dim='TIME')
        R10mm = (point_data >= 10).sum(skipna=True)
        R20mm = (point_data >= 20).sum(skipna=True)
        R65mm = ((point_data >= 65) & (point_data < 115)).sum(skipna=True)
        R115mm = ((point_data >= 115) & (point_data < 205)).sum(skipna=True)
        R205mm = (point_data >= 205).sum(skipna=True)
        dry_days = point_data < 1
        if np.any(dry_days):
            diff_idx = np.where(np.diff(np.concatenate(([False], dry_days, [False]))))[0]
            dry_lengths = np.diff(diff_idx)[::2]
            CDD = np.max(dry_lengths)
        else:
            CDD = 0
        wet_days = point_data >= 1
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
    write_header = not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0
    index_df.to_csv(csv_path, mode='a', header=write_header)
