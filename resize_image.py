from PIL import Image
import os

def resize_image(input_path, output_path=None, size=(640, 512)):
    """
    Resize an image to the specified dimensions.
    
    Args:
        input_path: Path to the input image
        output_path: Path to save the resized image (if None, overwrites original)
        size: Tuple of (width, height) - default is (640, 512)
    """
    try:
        # Open the image
        img = Image.open(input_path)
        
        # Resize the image
        resized_img = img.resize(size, Image.Resampling.LANCZOS)
        
        # Determine output path
        if output_path is None:
            output_path = input_path
        
        # Save the resized image
        resized_img.save(output_path)
        print(f"Image resized successfully: {output_path}")
        return resized_img
        
    except Exception as e:
        print(f"Error resizing image: {e}")
        return None

# Example usage:
if __name__ == "__main__":
    # Resize a single image
    resize_image("input.jpg", "output.jpg", size=(640, 512))
    
    # Or resize and overwrite the original
    # resize_image("input.jpg", size=(640, 512))
    
    # Resize all images in a folder
    # folder_path = "images"
    # for filename in os.listdir(folder_path):
    #     if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
    #         input_file = os.path.join(folder_path, filename)
    #         resize_image(input_file, size=(640, 512))

