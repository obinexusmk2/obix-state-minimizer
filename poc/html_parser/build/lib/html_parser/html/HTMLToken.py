from dataclasses import dataclass
from enum import Enum, auto
from typing import Optional, Dict, List

class HTMLTokenType(Enum):
    """Enum defining the types of HTML tokens"""
    START_TAG = auto()
    END_TAG = auto()
    TEXT = auto()
    COMMENT = auto()
    DOCTYPE = auto()
    CDATA = auto()
    EOF = auto()
    CONDITIONAL_COMMENT = auto()  

@dataclass(frozen=True, init=False)
class BaseToken:
    """Base class for all HTML tokens"""
    type: HTMLTokenType
    start: int
    end: int
    line: int
    column: int

    def __init__(self, type: HTMLTokenType, start: int, end: int, line: int, column: int, **kwargs):
        object.__setattr__(self, 'type', type)
        object.__setattr__(self, 'start', start)
        object.__setattr__(self, 'end', end)
        object.__setattr__(self, 'line', line)
        object.__setattr__(self, 'column', column)


@dataclass(frozen=True, init=False)
class StartTagToken(BaseToken):
    """Token representing an HTML start tag"""
    name: str
    attributes: Dict[str, str]
    self_closing: bool
    
    def __init__(self, type: HTMLTokenType, start: int, end: int, line: int, column: int,
                 name: str, attributes: Dict[str, str], self_closing: bool):
        super().__init__(type, start, end, line, column)
        object.__setattr__(self, 'name', name)
        object.__setattr__(self, 'attributes', attributes)
        object.__setattr__(self, 'self_closing', self_closing)

@dataclass(frozen=True, init=False)
class EndTagToken(BaseToken):
    """Token representing an HTML end tag"""
    name: str
    
    def __init__(self, type: HTMLTokenType, start: int, end: int, line: int, column: int,
                 name: str):
        super().__init__(type, start, end, line, column)
        object.__setattr__(self, 'name', name)

@dataclass(frozen=True, init=False)
class TextToken(BaseToken):
    """Token representing HTML text content"""
    content: str
    is_whitespace: bool
    
    def __init__(self, type: HTMLTokenType, start: int, end: int, line: int, column: int,
                 content: str, is_whitespace: bool):
        super().__init__(type, start, end, line, column)
        object.__setattr__(self, 'content', content)
        object.__setattr__(self, 'is_whitespace', is_whitespace)

@dataclass(frozen=True, init=False)
class CommentToken(BaseToken):
    """Token representing an HTML comment"""
    data: str
    
    def __init__(self, type: HTMLTokenType, start: int, end: int, line: int, column: int,
                 data: str):
        super().__init__(type, start, end, line, column)
        object.__setattr__(self, 'data', data)

@dataclass(frozen=True, init=False)
class DoctypeToken(BaseToken):
    """Token representing an HTML doctype declaration"""
    name: str
    
    def __init__(self, type: HTMLTokenType, start: int, end: int, line: int, column: int,
                 name: str):
        super().__init__(type, start, end, line, column)
        object.__setattr__(self, 'name', name)

@dataclass(frozen=True, init=False)
class CDATAToken(BaseToken):
    """Token representing CDATA content"""
    content: str
    
    def __init__(self, type: HTMLTokenType, start: int, end: int, line: int, column: int,
                 content: str):
        super().__init__(type, start, end, line, column)
        object.__setattr__(self, 'content', content)

@dataclass(frozen=True, init=False)
class EOFToken(BaseToken):
    """Token representing the end of file"""
    
    def __init__(self, type: HTMLTokenType, start: int, end: int, line: int, column: int):
        super().__init__(type, start, end, line, column)
class HTMLTokenizer:
    """HTML Tokenizer using shift-reduce parsing"""
    def __init__(self, raw_string: str):
        self.raw_string = raw_string
        self.current_pos = 0
        self.line = 1
        self.column = 1
        self.tokens: List[BaseToken] = []
        self.stack: List[str] = []
    
    def get_position(self) -> tuple[int, int, int]:
        """Get current position information"""
        return self.current_pos, self.line, self.column

    def shift(self) -> bool:
        """Shift a character onto the stack"""
        if self.current_pos < len(self.raw_string):
            char = self.raw_string[self.current_pos]
            self.stack.append(char)
            self.current_pos += 1
            
            if char == '\n':
                self.line += 1
                self.column = 1
            else:
                self.column += 1
                
            return True
        return False

    def parse_attributes(self, attributes_str: str) -> Dict[str, str]:
        """Parse HTML attributes string into a dictionary"""
        attributes = {}
        pattern = r'([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)|([^\s>]+)))?'
        
        for match in re.finditer(pattern, attributes_str.strip()):
            name = match.group(1).lower()
            value = next((m for m in match.groups()[1:] if m is not None), "")
            attributes[name] = value
            
        return attributes

    def match_start_tag(self, content: str) -> bool:
        """Match and reduce start tag tokens"""
        pattern = r'^<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^>/\s]+(?:\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^>\s]+))?)*)\s*(\/?)>'
        match = re.match(pattern, content)
        
        if match:
            start_pos, line, col = self.get_position()
            tag_name = match.group(1).lower()
            attributes_str = match.group(2)
            self_closing = bool(match.group(3))
            
            attributes = self.parse_attributes(attributes_str)
            
            token = StartTagToken(
                type=HTMLTokenType.START_TAG,
                name=tag_name,
                attributes=attributes,
                self_closing=self_closing,
                start=start_pos - len(content),
                end=start_pos,
                line=line,
                column=col
            )
            
            self.tokens.append(token)
            self.stack.clear()
            return True
        
        return False


    def match_end_tag(self, content: str) -> bool:
        pattern = r'^</([a-zA-Z][a-zA-Z0-9:-]*)\s*>'
        match = re.match(pattern, content)
        
        if match:
            start_pos, line, col = self.get_position()
            tag_name = match.group(1).lower()
            
            token = EndTagToken(
                type=HTMLTokenType.END_TAG,
                start=start_pos - len(content),
                end=start_pos,
                line=line,
                column=col,
                name=tag_name
            )
            
            self.tokens.append(token)
            self.stack.clear()
            return True
            
        return False

    def match_comment(self, content: str) -> bool:
        """Match and reduce comment tokens"""
        if content.startswith('<!--') and content.endswith('-->'):
            start_pos, line, col = self.get_position()
            comment_data = content[4:-3].strip()
            
            self.tokens.append(CommentToken(
                HTMLTokenType.COMMENT,
                start_pos - len(content),
                start_pos,
                line,
                col,
                comment_data
            ))
            self.stack.clear()
            return True
            
        return False

    def match_doctype(self, content: str) -> bool:
        """Match and reduce doctype tokens"""
        pattern = r'^<!DOCTYPE\s+([^>]+)>'
        match = re.match(pattern, content, re.IGNORECASE)
        
        if match:
            start_pos, line, col = self.get_position()
            doctype_content = match.group(1).strip()
            
            self.tokens.append(DoctypeToken(
                HTMLTokenType.DOCTYPE,
                start_pos - len(content),
                start_pos,
                line,
                col,
                doctype_content
            ))
            self.stack.clear()
            return True
            
        return False

    def match_cdata(self, content: str) -> bool:
        """Match and reduce CDATA tokens"""
        if content.startswith('<![CDATA[') and content.endswith(']]>'):
            start_pos, line, col = self.get_position()
            cdata_content = content[9:-3]
            
            self.tokens.append(CDATAToken(
                HTMLTokenType.CDATA,
                start_pos - len(content),
                start_pos,
                line,
                col,
                cdata_content
            ))
            self.stack.clear()
            return True
            
        return False


    def match_text(self, content: str) -> bool:
        if self.current_pos >= len(self.raw_string) or self.raw_string[self.current_pos] == '<':
            if content:
                start_pos, line, col = self.get_position()
                
                token = TextToken(
                    type=HTMLTokenType.TEXT,
                    start=start_pos - len(content),
                    end=start_pos,
                    line=line,
                    column=col,
                    content=content,
                    is_whitespace=bool(re.match(r'^\s*$', content))
                )
                
                self.tokens.append(token)
                self.stack.clear()
                return True
        
        return False

    def tokenize(self) -> List[BaseToken]:
        """Tokenize the input string into HTML tokens"""
        while self.current_pos < len(self.raw_string) or self.stack:
            if not self.match_start_tag(''.join(self.stack)) and \
               not self.match_end_tag(''.join(self.stack)) and \
               not self.match_comment(''.join(self.stack)) and \
               not self.match_doctype(''.join(self.stack)) and \
               not self.match_cdata(''.join(self.stack)) and \
               not self.match_text(''.join(self.stack)):
                if not self.shift():
                    break
        
        # Add EOF token
        self.tokens.append(EOFToken(
            HTMLTokenType.EOF,
            self.current_pos,
            self.current_pos,
            self.line,
            self.column
        ))
        
        return self.tokens
