from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class EmailRecord(BaseModel):
    id: str
    from_email: str
    subject: str
    body: str
    thread: List[str] = Field(default_factory=list)


class DraftReplyAction(BaseModel):
    type: Literal["draft_reply"] = "draft_reply"
    subject: str
    body: str


class CalendarEventAction(BaseModel):
    type: Literal["calendar_event"] = "calendar_event"
    title: str
    date: str
    time: str
    attendees: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class TaskListAction(BaseModel):
    type: Literal["task_list"] = "task_list"
    tasks: List[str] = Field(default_factory=list)


class TriageResult(BaseModel):
    summary: List[str] = Field(default_factory=list)
    priority: Literal["Urgent", "Requires Action", "FYI"]
    actions: List[dict] = Field(default_factory=list)


class TriageRequest(BaseModel):
    email_id: Optional[str] = None
    from_email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    thread: List[str] = Field(default_factory=list)


class EmailAssistRequest(BaseModel):
    email_id: Optional[str] = None
    from_email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    thread: List[str] = Field(default_factory=list)
    prompt: str


class ActionApprovalRequest(BaseModel):
    email_id: str
    action_type: Literal["draft_reply", "calendar_event", "task_list"]
    payload: dict
