from PIL import Image

# Simple one-liner version
def resize_image_simple(input_path, output_path):
    Image.open(input_path).resize((640, 512), Image.Resampling.LANCZOS).save(output_path)

# Usage:
# resize_image_simple("input.jpg", "output.jpg")

# Or even simpler - resize and save in one line:
# Image.open("input.jpg").resize((640, 512), Image.Resampling.LANCZOS).save("output.jpg")

