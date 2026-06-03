from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional, Dict, List, Tuple, Set, Any
import re
from collections import defaultdict
from .HTMLToken import HTMLTokenType, BaseToken

@dataclass
class Position:
    """Represents a position in the input text"""
    line: int
    column: int
    offset: int

@dataclass
class TokenizerState:
    """Represents the current state of the tokenizer"""
    position: int = 0
    line: int = 1
    column: int = 1
    stack: List[str] = field(default_factory=list)

@dataclass
class TokenizerError:
    """Represents an error encountered during tokenization"""
    message: str
    line: int
    column: int

class TokenizerOptions:
    """Configuration options for the tokenizer"""
    def __init__(self):
        self.xml_mode = False
        self.recognize_cdata = True
        self.recognize_conditional_comments = True
        self.preserve_whitespace = False

class HTMLTokenizer:
    """HTML Tokenizer implementation using shift-reduce parsing"""
    
    def __init__(self, input_text: str):
        self.input = input_text
        self.state = TokenizerState()
        self.tokens: List[BaseToken] = []
        self.errors: List[TokenizerError] = []
        self.options = TokenizerOptions()
        self._state_handlers = {
            '<': self._handle_tag_open,
            '': self._handle_text
        }
    
    def get_position(self) -> Position:
        """Get current position information"""
        return Position(
            line=self.state.line,
            column=self.state.column,
            offset=self.state.position
        )

    def peek(self, offset: int = 0) -> str:
        """Look ahead in the input stream without advancing"""
        pos = self.state.position + offset
        if pos >= len(self.input):
            return ''
        return self.input[pos]

    def advance(self, count: int = 1) -> str:
        """Advance the position and return the last character read"""
        chars = []
        for _ in range(count):
            if self.state.position >= len(self.input):
                break
            char = self.input[self.state.position]
            chars.append(char)
            self.state.position += 1
            if char == '\n':
                self.state.line += 1
                self.state.column = 1
            else:
                self.state.column += 1
        return chars[-1] if chars else ''

    def match(self, target: str) -> bool:
        """Check if the upcoming text matches the target"""
        return self.input.startswith(target, self.state.position)

    def skip_whitespace(self) -> None:
        """Skip over any whitespace characters"""
        while (self.state.position < len(self.input) and 
               self.input[self.state.position].isspace()):
            self.advance()

    def read_until(self, target: str) -> str:
        """Read characters until target is found"""
        result = []
        while self.state.position < len(self.input):
            if self.match(target):
                break
            result.append(self.advance())
        return ''.join(result)

    def read_tag_name(self) -> str:
        """Read a tag name"""
        result = []
        while self.state.position < len(self.input):
            char = self.peek()
            if not (char.isalnum() or char in ':-'):
                break
            result.append(self.advance())
        return ''.join(result)

    def read_attributes(self) -> Dict[str, str]:
        """Read HTML tag attributes"""
        attributes = {}
        while self.state.position < len(self.input):
            self.skip_whitespace()
            
            if self.peek() in ['>', '/', '<']:
                break
                
            name = self.read_attribute_name()
            if not name:
                break
                
            value = ''
            self.skip_whitespace()
            
            if self.peek() == '=':
                self.advance()
                self.skip_whitespace()
                value = self.read_attribute_value()
                
            attributes[name.lower()] = value
            
        return attributes

    def read_attribute_name(self) -> str:
        """Read an attribute name"""
        result = []
        while self.state.position < len(self.input):
            char = self.peek()
            if char.isspace() or char in ['=', '>', '/', '<']:
                break
            result.append(self.advance())
        return ''.join(result)

    def read_attribute_value(self) -> str:
        """Read an attribute value"""
        quote = self.peek()
        if quote in ['"', "'"]:
            self.advance()
            value = self.read_until(quote)
            self.advance()
            return value
            
        result = []
        while self.state.position < len(self.input):
            char = self.peek()
            if char.isspace() or char in ['>', '<']:
                break
            result.append(self.advance())
        return ''.join(result)

    def _handle_tag_open(self, start_pos: Position) -> None:
        """Handle opening of a tag"""
        self.advance()  # Skip '<'
        
        if self.peek() == '/':
            self._handle_end_tag(start_pos)
        elif self.peek() == '!':
            self._handle_markup_declaration(start_pos)
        else:
            self._handle_start_tag(start_pos)

    def _handle_start_tag(self, start_pos: Position) -> None:
        """Handle a start tag"""
        name = self.read_tag_name()
        if not name:
            self.errors.append(TokenizerError(
                message="Invalid start tag name",
                line=self.state.line,
                column=self.state.column
            ))
            return

        namespace = None
        if self.options.xml_mode and ':' in name:
            namespace, name = name.split(':', 1)

        attributes = self.read_attributes()
        self.skip_whitespace()
        
        self_closing = False
        if self.peek() == '/':
            self_closing = True
            self.advance()

        if self.peek() == '>':
            self.advance()
            
            self.tokens.append(BaseToken(
                type=HTMLTokenType.START_TAG,
                name=name.lower(),
                attributes=attributes,
                self_closing=self_closing,
                namespace=namespace,
                start=start_pos.offset,
                end=self.state.position,
                line=start_pos.line,
                column=start_pos.column
            ))
        else:
            self.errors.append(TokenizerError(
                message="Unclosed start tag",
                line=self.state.line,
                column=self.state.column
            ))

    def _handle_end_tag(self, start_pos: Position) -> None:
        """Handle an end tag"""
        self.advance()  # Skip '/'
        name = self.read_tag_name()
        
        if not name:
            self.errors.append(TokenizerError(
                message="Invalid end tag name",
                line=self.state.line,
                column=self.state.column
            ))
            return

        namespace = None
        if self.options.xml_mode and ':' in name:
            namespace, name = name.split(':', 1)

        self.skip_whitespace()
        if self.peek() == '>':
            self.advance()
            
            self.tokens.append(BaseToken(
                type=HTMLTokenType.END_TAG,
                name=name.lower(),
                namespace=namespace,
                start=start_pos.offset,
                end=self.state.position,
                line=start_pos.line,
                column=start_pos.column
            ))
        else:
            self.errors.append(TokenizerError(
                message="Unclosed end tag",
                line=self.state.line,
                column=self.state.column
            ))

    def _handle_markup_declaration(self, start_pos: Position) -> None:
        """Handle markup declarations"""
        self.advance()  # Skip '!'
        
        if self.match('--'):
            self._handle_comment(start_pos)
        elif self.match('[CDATA[') and self.options.recognize_cdata:
            self._handle_cdata(start_pos)
        elif self.match('DOCTYPE'):
            self._handle_doctype(start_pos)
        else:
            self.errors.append(TokenizerError(
                message="Invalid markup declaration",
                line=self.state.line,
                column=self.state.column
            ))

    def _handle_comment(self, start_pos: Position) -> None:
        """Handle HTML comments"""
        self.advance(2)  # Skip '--'
        content = self.read_until('-->')
        
        if self.match('-->'):
            self.advance(3)
            
            if (self.options.recognize_conditional_comments and 
                content.startswith('[if')):
                # Handle conditional comment
                condition_end = content.find(']')
                if condition_end != -1:
                    condition = content[3:condition_end].strip()
                    comment_content = content[condition_end+1:].strip()
                    self.tokens.append(BaseToken(
                        type=HTMLTokenType.CONDITIONAL_COMMENT,
                        condition=condition,
                        content=comment_content,
                        start=start_pos.offset,
                        end=self.state.position,
                        line=start_pos.line,
                        column=start_pos.column
                    ))
            else:
                # Handle regular comment
                self.tokens.append(BaseToken(
                    type=HTMLTokenType.COMMENT,
                    data=content.strip(),
                    start=start_pos.offset,
                    end=self.state.position,
                    line=start_pos.line,
                    column=start_pos.column
                ))
        else:
            self.errors.append(TokenizerError(
                message="Unclosed comment",
                line=self.state.line,
                column=self.state.column
            ))

    def _handle_cdata(self, start_pos: Position) -> None:
        """Handle CDATA sections"""
        self.advance(7)  # Skip '[CDATA['
        content = self.read_until(']]>')
        
        if self.match(']]>'):
            self.advance(3)
            
            self.tokens.append(BaseToken(
                type=HTMLTokenType.CDATA,
                content=content,
                start=start_pos.offset,
                end=self.state.position,
                line=start_pos.line,
                column=start_pos.column
            ))
        else:
            self.errors.append(TokenizerError(
                message="Unclosed CDATA section",
                line=self.state.line,
                column=self.state.column
            ))

    def _handle_doctype(self, start_pos: Position) -> None:
        """Handle DOCTYPE declarations"""
        self.advance(7)  # Skip 'DOCTYPE'
        self.skip_whitespace()
        
        name = self.read_tag_name()
        if name:
            self.skip_whitespace()
            remaining = self.read_until('>')
            self.advance()
            
            self.tokens.append(BaseToken(
                type=HTMLTokenType.DOCTYPE,
                name=name.upper(),
                start=start_pos.offset,
                end=self.state.position,
                line=start_pos.line,
                column=start_pos.column
            ))
        else:
            self.errors.append(TokenizerError(
                message="Invalid DOCTYPE declaration",
                line=self.state.line,
                column=self.state.column
            ))

    def _handle_text(self, start_pos: Position) -> None:
        """Handle text content"""
        content = []
        while self.state.position < len(self.input):
            if self.peek() == '<':
                break
            content.append(self.advance())
        
        text = ''.join(content)
        if text or self.options.preserve_whitespace:
            self.tokens.append(BaseToken(
                type=HTMLTokenType.TEXT,
                content=text,
                is_whitespace=text.isspace(),
                start=start_pos.offset,
                end=self.state.position,
                line=start_pos.line,
                column=start_pos.column
            ))

    def tokenize(self) -> Tuple[List[BaseToken], List[TokenizerError]]:
        """Tokenize the input string into HTML tokens"""
        while self.state.position < len(self.input):
            start_pos = self.get_position()
            char = self.peek()
            
            handler = self._state_handlers.get(char, self._state_handlers[''])
            handler(start_pos)

        # Add EOF token
        end_pos = self.get_position()
        self.tokens.append(BaseToken(
            type=HTMLTokenType.EOF,
            start=end_pos.offset,
            end=end_pos.offset,
            line=end_pos.line,
            column=end_pos.column
        ))

        return self.tokens, self.errors
        