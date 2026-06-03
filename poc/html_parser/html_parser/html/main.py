#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Any, Optional
import time

from .HTMLTokenizer import HTMLTokenizer  # Fixed import
from .HTMLParser import HTMLParser
from .HTMLAstOptimizer import HTMLAstOptimizer

class HTMLProcessor:
    """Handles the HTML processing pipeline from tokenization to optimization"""
    
    def __init__(self, input_file: str, options: Dict[str, Any]):
        self.input_file = input_file
        self.options = options
        self.tokens = []
        self.ast = None
        self.optimized_ast = None
        self.metrics = {
            'tokenization_time': 0,
            'parsing_time': 0,
            'optimization_time': 0,
            'total_time': 0
        }

    def process(self) -> Dict[str, Any]:
        """Run the complete processing pipeline"""
        start_time = time.time()
        
        # Tokenization phase
        tokenization_start = time.time()
        self.tokenize()
        self.metrics['tokenization_time'] = time.time() - tokenization_start
        
        # Parsing phase
        parsing_start = time.time()
        self.parse()
        self.metrics['parsing_time'] = time.time() - parsing_start
        
        # Optimization phase
        if not self.options.get('skip_optimization'):
            optimization_start = time.time()
            self.optimize()
            self.metrics['optimization_time'] = time.time() - optimization_start
        
        self.metrics['total_time'] = time.time() - start_time
        
        return {
            'tokens': self.tokens if self.options.get('include_tokens') else None,
            'ast': self.ast if self.options.get('include_ast') else None,
            'optimized_ast': self.optimized_ast,
            'metrics': self.metrics
        }

    def tokenize(self) -> None:
        """Tokenize the input HTML"""
        try:
            with open(self.input_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tokenizer = HTMLTokenizer(content)
            self.tokens, errors = tokenizer.tokenize()
            
            if errors and not self.options.get('ignore_errors'):
                for error in errors:
                    print(f"Tokenizer error: {error.message} at line {error.line}, column {error.column}",
                          file=sys.stderr)
                if self.options.get('strict'):
                    raise ValueError("Tokenization failed due to errors")
                    
        except Exception as e:
            print(f"Error during tokenization: {str(e)}", file=sys.stderr)
            raise

    def parse(self) -> None:
        """Parse the tokens into an AST"""
        try:
            parser = HTMLParser()
            self.ast = parser.parse(self.tokens)
            
        except Exception as e:
            print(f"Error during parsing: {str(e)}", file=sys.stderr)
            raise

    def optimize(self) -> None:
        """Optimize the AST"""
        try:
            optimizer = HTMLAstOptimizer()
            self.optimized_ast = optimizer.optimize(self.ast)
            
        except Exception as e:
            print(f"Error during optimization: {str(e)}", file=sys.stderr)
            raise

def format_output(data: Dict[str, Any], format_type: str) -> str:
    """Format the output data according to the specified format"""
    if format_type == 'json':
        return json.dumps(data, indent=2)
    elif format_type == 'pretty':
        return pretty_print_data(data)
    else:
        return str(data)

def pretty_print_data(data: Dict[str, Any], indent: int = 0) -> str:
    """Pretty print the processing results"""
    output = []
    
    # Print metrics
    output.append("Processing Metrics:")
    metrics = data['metrics']
    for key, value in metrics.items():
        output.append(f"  {key}: {value:.4f} seconds")
    
    # Print optimization results if available
    if data.get('optimized_ast'):
        ast_metrics = data['optimized_ast'].get('metadata', {}).get('optimization_metrics', {})
        if ast_metrics:
            output.append("\nOptimization Metrics:")
            for category, values in ast_metrics.items():
                output.append(f"  {category}:")
                if isinstance(values, dict):
                    for key, value in values.items():
                        output.append(f"    {key}: {value}")
                else:
                    output.append(f"    {values}")
    
    return '\n'.join(output)

def setup_argparse() -> argparse.ArgumentParser:
    """Set up command line argument parsing"""
    parser = argparse.ArgumentParser(
        description='HTML Processing Pipeline Demo',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s input.html
  %(prog)s -v --format json input.html
  %(prog)s --no-optimize --include-tokens input.html
  %(prog)s --strict --output processed.json input.html
        """
    )
    
    parser.add_argument('input_file',
                      help='Input HTML file to process')
    
    parser.add_argument('-o', '--output',
                      help='Output file (default: stdout)')
    
    parser.add_argument('-f', '--format',
                      choices=['json', 'pretty', 'raw'],
                      default='pretty',
                      help='Output format (default: pretty)')
    
    parser.add_argument('--no-optimize',
                      action='store_true',
                      help='Skip AST optimization')
    
    parser.add_argument('--include-tokens',
                      action='store_true',
                      help='Include tokenization results in output')
    
    parser.add_argument('--include-ast',
                      action='store_true',
                      help='Include unoptimized AST in output')
    
    parser.add_argument('--ignore-errors',
                      action='store_true',
                      help='Continue processing despite non-fatal errors')
    
    parser.add_argument('--strict',
                      action='store_true',
                      help='Treat all errors as fatal')
    
    parser.add_argument('-v', '--verbose',
                      action='store_true',
                      help='Enable verbose output')
    
    return parser

def main() -> None:
    """Main entry point for the CLI demo"""
    parser = setup_argparse()
    args = parser.parse_args()
    
    # Prepare processing options
    options = {
        'skip_optimization': args.no_optimize,
        'include_tokens': args.include_tokens,
        'include_ast': args.include_ast,
        'ignore_errors': args.ignore_errors,
        'strict': args.strict,
        'verbose': args.verbose
    }
    
    try:
        # Create and run processor
        processor = HTMLProcessor(args.input_file, options)
        result = processor.process()
        
        # Format output
        output = format_output(result, args.format)
        
        # Write output
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(output)
        else:
            print(output)
            
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()