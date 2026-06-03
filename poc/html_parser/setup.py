from setuptools import setup, find_packages

setup(
    name="html-parser-poc",
    version="0.1.0",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[],
    entry_points={
        "console_scripts": [
            "html-parser=html_parser.html.main:main",  # Changed from html-parser-poc to html-parser
        ],
    },
)