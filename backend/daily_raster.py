import xarray as xr
from shapely.geometry import box
from datetime import datetime, timedelta
import rasterio
from rasterio.transform import from_origin




def download_raster_daily_range(bbox, start_date, end_date):
    current_date = datetime.strptime(start_date, '%Y-%m-%d')
    end_date = datetime.strptime(end_date, '%Y-%m-%d')
    
    while current_date <= end_date:
        year = current_date.year
        month = current_date.month
        day = current_date.day
        
        nc_file = f'data/RF25_ind{year}_rfp25.nc'
        ds = xr.open_dataset(nc_file)
        
        mask = ((ds.LONGITUDE >= bbox.bounds[0]) & (ds.LONGITUDE <= bbox.bounds[2]) & (ds.LATITUDE >= bbox.bounds[1]) & (ds.LATITUDE <= bbox.bounds[3]))
        masked_data = ds['RAINFALL'].where(mask, drop=True)
        
        selected_data = masked_data.sel(TIME=f'{year}-{month:02}-{day:02}')
        
        output_filename = f'rainfall_{year}-{month:02}-{day:02}.tif'
        
        # Set geotransform for the output raster
        transform = from_origin(bbox.bounds[0], bbox.bounds[3], 0.05, 0.05)  # Assuming 0.05 is the pixel size
        with rasterio.open(output_filename, 'w', driver='GTiff', height=selected_data.shape[0], width=selected_data.shape[1], count=1, dtype=str(selected_data.dtype), crs='EPSG:4326', transform=transform) as dst:
            dst.write(selected_data.values, 1)
        
        ds.close()
        
        current_date += timedelta(days=1)


