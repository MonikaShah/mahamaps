import xarray as xr
from shapely.geometry import box
import pandas as pd
import os


def rainfall(start_year,end_year,bbox):

    index_df = pd.DataFrame()

    for year in range(start_year, end_year + 1):
        nc_file = f'data/RF25_ind{year}_rfp25.nc'
        ds = xr.open_dataset(nc_file)

        mask = ((ds.LONGITUDE >= bbox.bounds[0]) & (ds.LONGITUDE <= bbox.bounds[2]) & (ds.LATITUDE >= bbox.bounds[1]) & (ds.LATITUDE <= bbox.bounds[3]))
        masked_data = ds['RAINFALL'].where(mask, drop=True)

        daily_avg_rainfall = masked_data.mean(dim=['LONGITUDE', 'LATITUDE'], skipna=True)

        # Convert DataArray to DataFrame
        daily_avg_df = daily_avg_rainfall.to_dataframe(name='daily_avg_rainfall')

        index_df = pd.concat([index_df, daily_avg_df], axis=0)

        ds.close()

    # Reset index to create a timestamp index
    index_df.reset_index(inplace=True)
    index_df.rename(columns={'TIME': 'timestamp'}, inplace=True)

    # Save to CSV
    csv_path = 'daily_rainfall.csv'
    write_header = not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0
    index_df.to_csv(csv_path, mode='a', header=write_header, index=False)
