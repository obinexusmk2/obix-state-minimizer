from dataclasses import dataclass
from typing import Dict, Set, List, Optional, Any, Union
from weakref import WeakKeyDictionary
import json
from collections import defaultdict

@dataclass
class StateClass:
    """Represents an equivalence class of states"""
    signature: str
    nodes: Set[Any]

@dataclass
class OptimizationMetrics:
    """Metrics for AST optimization"""
    node_reduction: Dict[str, int]
    memory_usage: Dict[str, int]
    state_classes: Dict[str, Union[int, float]]

class HTMLAstOptimizer:
    """Optimizes HTML Abstract Syntax Trees through state minimization and node reduction"""
    
    def __init__(self):
        self.state_classes: Dict[int, StateClass] = {}
        self.node_signatures: Dict[str, Set[Any]] = {}
        self.minimized_nodes = WeakKeyDictionary()  # Use WeakKeyDictionary instead of WeakMap

    def optimize(self, ast: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize the AST through multiple phases
        """
        # Phase 1: Build state equivalence classes
        self.build_state_classes(ast)
        
        # Phase 2: Node reduction and path optimization
        optimized_ast = self.optimize_node(ast['root'])
        
        # Phase 3: Memory optimization
        self.apply_memory_optimizations(optimized_ast)

        # Compute optimization metrics
        metrics = self.compute_optimization_metrics(ast['root'], optimized_ast)

        return {
            'root': optimized_ast,
            'metadata': {
                **ast.get('metadata', {}),
                'optimization_metrics': metrics
            }
        }

    def build_state_classes(self, ast: Dict[str, Any]) -> None:
        """Build equivalence classes for states in the AST"""
        state_signatures: Dict[str, Set[Any]] = {}
        
        def collect_signatures(node: Any) -> None:
            signature = self.compute_node_signature(node)
            if signature not in state_signatures:
                state_signatures[signature] = set()
            state_signatures[signature].add(node)
            
            children = node.get('children', [])
            for child in children:
                collect_signatures(child)
        
        collect_signatures(ast['root'])
        
        # Build equivalence classes
        for class_id, (signature, nodes) in enumerate(state_signatures.items()):
            if len(nodes) > 1:
                self.state_classes[class_id] = StateClass(
                    signature=signature,
                    nodes=nodes
                )

    def compute_node_signature(self, node: Any) -> str:
        """Compute a unique signature for a node based on its properties"""
        components = []
        
        # Add type and name
        components.append(node.get('type', ''))
        if 'name' in node:
            components.append(node['name'])
        
        # Add attributes signature
        attributes = node.get('attributes', {})
        if attributes:
            sorted_attrs = sorted(attributes.items())
            components.append(json.dumps(sorted_attrs))
        
        # Add children types signature
        children = node.get('children', [])
        if children:
            children_types = ','.join(child.get('type', '') for child in children)
            components.append(children_types)
        
        return '|'.join(components)

    def optimize_node(self, node: Any) -> Dict[str, Any]:
        """Optimize a single node and its children"""
        # Check if node has already been minimized
        if node in self.minimized_nodes:
            return self.minimized_nodes[node]
        
        # Create optimized node
        optimized = {
            'type': node['type'],
            'metadata': {
                **node.get('metadata', {}),
                'is_minimized': True
            }
        }
        
        # Copy essential properties
        if 'name' in node:
            optimized['name'] = node['name']
        if 'value' in node:
            optimized['value'] = node['value']
        if 'attributes' in node:
            optimized['attributes'] = {
                key: value for key, value in node['attributes'].items()
                if value is not None and value != ''
            }
        
        # Optimize children
        children = node.get('children', [])
        if children:
            optimized['children'] = self.optimize_children(children)
        else:
            optimized['children'] = []
        
        # Cache optimized node
        self.minimized_nodes[node] = optimized
        
        return optimized

    def optimize_children(self, children: List[Any]) -> List[Dict[str, Any]]:
        """Optimize a list of child nodes"""
        # Remove redundant text nodes
        optimized_children = []
        for child in children:
            if child['type'] == 'Text':
                if child.get('value', '').strip():
                    optimized_children.append(self.optimize_node(child))
            else:
                optimized_children.append(self.optimize_node(child))
        
        # Merge adjacent text nodes
        return self.merge_adjacent_text_nodes(optimized_children)

    def merge_adjacent_text_nodes(self, children: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Merge adjacent text nodes into single nodes"""
        merged = []
        current_text_node = None
        
        for child in children:
            if child['type'] == 'Text':
                if current_text_node:
                    current_text_node['value'] += child['value']
                else:
                    current_text_node = child.copy()
                    merged.append(current_text_node)
            else:
                current_text_node = None
                merged.append(child)
        
        return merged

    def apply_memory_optimizations(self, node: Dict[str, Any]) -> None:
        """Apply memory optimizations to the node and its children"""
        # Note: Python doesn't have Object.freeze(), but we can make objects immutable
        # by converting mutable structures to immutable ones
        
        # Convert metadata dict to frozendict if available or tuple of items
        node['metadata'] = tuple(sorted(node['metadata'].items()))
        
        # Convert attributes dict to tuple of items
        if 'attributes' in node:
            node['attributes'] = tuple(sorted(node['attributes'].items()))
        
        # Recursively optimize children
        children = node.get('children', [])
        for child in children:
            self.apply_memory_optimizations(child)
        
        # Convert children list to tuple
        if children:
            node['children'] = tuple(children)

    def compute_optimization_metrics(self, original_root: Any, optimized_root: Any) -> OptimizationMetrics:
        """Compute metrics about the optimization process"""
        original_metrics = self.get_node_metrics(original_root)
        optimized_metrics = self.get_node_metrics(optimized_root)
        
        # Calculate average state class size
        total_nodes = sum(len(cls.nodes) for cls in self.state_classes.values())
        avg_class_size = total_nodes / len(self.state_classes) if self.state_classes else 0
        
        return OptimizationMetrics(
            node_reduction={
                'original': original_metrics.total_nodes,
                'optimized': optimized_metrics.total_nodes,
                'ratio': optimized_metrics.total_nodes / original_metrics.total_nodes
            },
            memory_usage={
                'original': original_metrics.estimated_memory,
                'optimized': optimized_metrics.estimated_memory,
                'ratio': optimized_metrics.estimated_memory / original_metrics.estimated_memory
            },
            state_classes={
                'count': len(self.state_classes),
                'average_size': avg_class_size
            }
        )

    def get_node_metrics(self, node: Any) -> 'NodeMetrics':
        """Calculate metrics for a single node and its subtree"""
        @dataclass
        class NodeMetrics:
            total_nodes: int = 0
            estimated_memory: int = 0
        
        metrics = NodeMetrics()
        
        def calculate_metrics(node: Any) -> None:
            metrics.total_nodes += 1
            metrics.estimated_memory += self.estimate_node_memory(node)
            
            for child in node.get('children', []):
                calculate_metrics(child)
        
        calculate_metrics(node)
        return metrics

    def estimate_node_memory(self, node: Any) -> int:
        """Estimate memory usage for a single node"""
        bytes_used = 0
        
        # Base object overhead (approximate for Python)
        bytes_used += 64
        
        # Type and name strings
        bytes_used += len(node.get('type', '')) * 2
        bytes_used += len(node.get('name', '')) * 2
        
        # Value for text nodes
        if node.get('type') == 'Text':
            bytes_used += len(node.get('value', '')) * 2
        
        # Attributes
        for key, value in node.get('attributes', {}).items():
            bytes_used += (len(key) + len(str(value))) * 2
        
        # Metadata
        metadata_str = json.dumps(node.get('metadata', {}))
        bytes_used += len(metadata_str) * 2
        
        return bytes_used