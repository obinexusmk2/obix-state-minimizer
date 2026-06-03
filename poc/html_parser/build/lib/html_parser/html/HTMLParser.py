from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional, Dict, List, Set, Tuple, Any, FrozenSet
import re
from collections import defaultdict
from .HTMLToken import HTMLTokenType, BaseToken

class ParserState(Enum):
    """States for the HTML parser"""
    INITIAL = auto()
    IN_TAG = auto()
    IN_CONTENT = auto()
    IN_COMMENT = auto()
    IN_DOCTYPE = auto()
    FINAL = auto()

class HTMLParserError(Exception):
    """Custom error for HTML parsing issues"""
    def __init__(self, message: str, token: Any, state: ParserState, position: int):
        super().__init__(f"{message} at position {position}")
        self.token = token
        self.state = state
        self.position = position


@dataclass(frozen=True)
class State:
    """Represents a state in the parser's state machine"""
    type: ParserState
    is_accepting: bool
    transitions: FrozenSet[Tuple[str, 'State']] = field(default_factory=frozenset)
    
    def add_transition(self, symbol: str, target: 'State') -> 'State':
        new_transitions = set(self.transitions)
        new_transitions.add((symbol, target))
        return State(self.type, self.is_accepting, frozenset(new_transitions))
        
    def get_transition(self, symbol: str) -> Optional['State']:
        for sym, target in self.transitions:
            if sym == symbol:
                return target
        return None

@dataclass
class ASTNode:
    """Base class for AST nodes"""
    type: str
    children: List['ASTNode'] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ElementNode(ASTNode):
    """Represents an HTML element in the AST"""
    type: str
    children: List['ASTNode'] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    name: str = ''
    attributes: Dict[str, str] = field(default_factory=dict)

@dataclass
class TextNode(ASTNode):
    """Represents text content in the AST"""
    type: str
    value: str = ''
    children: List['ASTNode'] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class CommentNode(ASTNode):
    """Represents a comment in the AST"""
    type: str
    value: str = ''
    children: List['ASTNode'] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

class HTMLParser:
    """HTML Parser with state machine minimization and AST optimization"""
    
    def __init__(self):
        self.states: Set[State] = set()
        self.current_state: Optional[State] = None
        self.equivalence_classes: Dict[int, Set[State]] = {}
        self.optimized_state_map: Dict[State, State] = {}
        self.initialize_states()

    def initialize_states(self) -> None:
        """Initialize the parser's state machine"""
        # Create states
        initial_state = State(ParserState.INITIAL, False)
        in_tag_state = State(ParserState.IN_TAG, False)
        in_content_state = State(ParserState.IN_CONTENT, True)
        in_comment_state = State(ParserState.IN_COMMENT, False)
        in_doctype_state = State(ParserState.IN_DOCTYPE, False)
        final_state = State(ParserState.FINAL, True)

        # Set up transitions
        initial_state = initial_state.add_transition('<', in_tag_state)
        initial_state = initial_state.add_transition('text', in_content_state)
        
        in_tag_state = in_tag_state.add_transition('>', in_content_state)
        in_tag_state = in_tag_state.add_transition('!', in_doctype_state)
        in_tag_state = in_tag_state.add_transition('<!--', in_comment_state)
        
        in_content_state = in_content_state.add_transition('<', in_tag_state)
        in_content_state = in_content_state.add_transition('EOF', final_state)
        
        in_comment_state = in_comment_state.add_transition('-->', in_content_state)
        in_doctype_state = in_doctype_state.add_transition('>', in_content_state)

        # Initialize state collections
        self.states = {initial_state, in_tag_state, in_content_state, 
                      in_comment_state, in_doctype_state, final_state}
        self.current_state = initial_state
        self.equivalence_classes.clear()
        self.optimized_state_map.clear()

    def _get_state_signature(self, state: State, partition: List[Set[State]]) -> str:
        """Generate a unique signature for a state based on its transitions"""
        transitions = []
        for symbol, target_state in state.transitions:
            target_partition = next(i for i, block in enumerate(partition) 
                                 if target_state in block)
            transitions.append(f"{symbol}:{target_partition}")
        return '|'.join(sorted(transitions))

    def parse(self, input_text: str) -> Dict[str, Any]:
        """Parse HTML input and return optimized AST"""
        from html_tokenizer import HTMLTokenizer  # Import the tokenizer we created earlier
        
        tokenizer = HTMLTokenizer(input_text)
        tokens, _ = tokenizer.tokenize()
        
        self.minimize_states()
        ast = self.build_optimized_ast(tokens)
        return self.optimize_ast(ast)

    def minimize_states(self) -> None:
        """Minimize the number of states in the state machine"""
        # Initial partition: accepting vs non-accepting states
        accepting = {s for s in self.states if s.is_accepting}
        non_accepting = {s for s in self.states if not s.is_accepting}
        
        partition = [accepting, non_accepting]
        while True:
            new_partition = []
            
            for block in partition:
                splits = self.split_block(block, partition)
                new_partition.extend(splits)
            
            if len(new_partition) == len(partition):
                break
            
            partition = new_partition
        
        # Store equivalence classes
        for idx, block in enumerate(partition):
            self.equivalence_classes[idx] = block

    def split_block(self, block: Set[State], partition: List[Set[State]]) -> List[Set[State]]:
        """Split a block of states based on their transitions"""
        if len(block) <= 1:
            return [block]
        
        splits = defaultdict(set)
        for state in block:
            signature = self._get_state_signature(state, partition)
            splits[signature].add(state)
        
        return list(splits.values())


    def build_optimized_ast(self, tokens: List[Any]) -> Dict[str, Any]:
        """Build an optimized AST from tokens"""
        root = ElementNode(
            type='Element',
            name='root',
            metadata={'equivalence_class': 0, 'is_minimized': False}
        )

        stack = [root]
        current_node = root

        for token in tokens:
            try:
                current_node = self._process_token_with_optimized_state(
                    token, current_node, stack)
            except HTMLParserError as error:
                self._handle_parser_error(error, current_node)

        return {
            'root': root,
            'metadata': self._compute_optimized_metadata(root)
        }

    def _process_token_with_optimized_state(
        self, token: Any, current_node: ASTNode, stack: List[ASTNode]
    ) -> ASTNode:
        """Process a token using the optimized state machine"""
        optimized_state = self.optimized_state_map.get(
            self.current_state, self.current_state)

        if token.type == 'StartTag':
            element = ElementNode(
                type='Element',
                name=token.name,
                attributes=dict(token.attributes) if token.attributes else {},
                metadata={
                    'equivalence_class': self._get_equivalence_class(optimized_state),
                    'is_minimized': True
                }
            )
            current_node.children.append(element)
            if not token.self_closing:
                stack.append(element)
                current_node = element

        elif token.type == 'EndTag':
            if len(stack) > 1:
                for i in range(len(stack) - 1, 0, -1):
                    if stack[i].name == token.name:
                        current_node = stack[i]
                        stack[i:] = []
                        return stack[i - 1]
                if len(stack) > 1:
                    stack.pop()
                    current_node = stack[-1]

        elif token.type == 'Text':
            if token.content.strip() or token.is_whitespace:
                node = TextNode(
                    type='Text',
                    value=token.content,
                    metadata={
                        'equivalence_class': self._get_equivalence_class(optimized_state),
                        'is_minimized': True
                    }
                )
                current_node.children.append(node)

        elif token.type == 'Comment':
            node = CommentNode(
                type='Comment',
                value=token.data,
                metadata={
                    'equivalence_class': self._get_equivalence_class(optimized_state),
                    'is_minimized': True
                }
            )
            current_node.children.append(node)

        return current_node

    def optimize_ast(self, ast: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize the AST by merging and removing redundant nodes"""
        self._merge_text_nodes(ast['root'])
        self._remove_redundant_nodes(ast['root'])
        self._optimize_attributes(ast['root'])

        ast['metadata']['minimization_metrics'] = {
            'original_state_count': len(self.states),
            'minimized_state_count': len(self.equivalence_classes),
            'optimization_ratio': len(self.equivalence_classes) / len(self.states)
        }

        return ast

    def _merge_text_nodes(self, node: ASTNode) -> None:
        """Merge adjacent text nodes"""
        if not node.children:
            return

        for child in node.children:
            if isinstance(child, ElementNode):
                self._merge_text_nodes(child)

        i = 0
        while i < len(node.children) - 1:
            current = node.children[i]
            next_node = node.children[i + 1]

            if (isinstance(current, TextNode) and 
                isinstance(next_node, TextNode)):
                current.value = (current.value or '') + (next_node.value or '')
                node.children.pop(i + 1)
            else:
                i += 1

    def _remove_redundant_nodes(self, node: ASTNode) -> None:
        """Remove redundant nodes from the AST"""
        node.children = [
            child for child in node.children
            if not (isinstance(child, TextNode) and 
                   not child.value.strip())
        ]
        
        for child in node.children:
            if isinstance(child, (ElementNode, CommentNode)):
                self._remove_redundant_nodes(child)

    def _optimize_attributes(self, node: ASTNode) -> None:
        """Optimize element attributes"""
        if isinstance(node, ElementNode) and node.attributes:
            node.attributes = {
                key.lower(): value
                for key, value in node.attributes.items()
            }

        for child in node.children:
            self._optimize_attributes(child)

    def _get_equivalence_class(self, state: State) -> int:
        """Get the equivalence class for a state"""
        for class_id, states in self.equivalence_classes.items():
            if state in states:
                return class_id
        return -1

    def _handle_parser_error(self, error: HTMLParserError, current_node: ASTNode) -> None:
        """Handle parsing errors"""
        print(f"Parser error in state {error.state.type}: {error.message}")

    def _compute_optimized_metadata(self, root: ASTNode) -> Dict[str, int]:
        """Compute metadata about the AST"""
        metadata = {
            'node_count': 0,
            'element_count': 0,
            'text_count': 0,
            'comment_count': 0
        }

        def count_nodes(node: ASTNode) -> None:
            metadata['node_count'] += 1
            if isinstance(node, ElementNode):
                metadata['element_count'] += 1
            elif isinstance(node, TextNode):
                metadata['text_count'] += 1
            elif isinstance(node, CommentNode):
                metadata['comment_count'] += 1
            for child in node.children:
                count_nodes(child)

        count_nodes(root)
        return metadata