import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { io, Socket } from 'socket.io-client';

interface Room {
    id: string;
    name: string;
    hasPassword: boolean;
    playerCount: number;
}

interface MultiplayerMenuProps {
    onBack: () => void;
    onJoinGame: (socket: Socket, roomId: string) => void;
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = ({ onBack, onJoinGame }) => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [roomName, setRoomName] = useState('');
    const [password, setPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [joinPassword, setJoinPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const username = useStore(state => state.username);
    const setUsername = useStore(state => state.setUsername);

    useEffect(() => {
        const newSocket = io();
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to server');
        });

        newSocket.on('room_list', (updatedRooms: Room[]) => {
            setRooms(updatedRooms);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const handleCreateRoom = () => {
        if (!socket) return;
        if (!roomName.trim()) {
            setError("Room name cannot be empty");
            return;
        }

        socket.emit('create_room', { name: roomName, password }, (response: { success: boolean, roomId: string, message?: string }) => {
            if (response.success) {
                onJoinGame(socket, response.roomId);
            } else {
                setError(response.message || "Failed to create room");
            }
        });
    };

    const handleJoinRoom = () => {
        if (!socket || !selectedRoom) return;

        const room = rooms.find(r => r.id === selectedRoom);
        if (room?.hasPassword && !joinPassword) {
            setError("Password required");
            return;
        }

        socket.emit('join_room', { roomId: selectedRoom, password: joinPassword }, (response: { success: boolean, message?: string }) => {
            if (response.success) {
                onJoinGame(socket, selectedRoom);
            } else {
                setError(response.message || "Failed to join room");
            }
        });
    };

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white font-mono z-50">
            <div className="w-full max-w-4xl p-8 bg-gray-900 rounded-lg shadow-xl border border-gray-700 flex flex-col gap-6">
                
                {/* Header with Username Input */}
                <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                    <h1 className="text-3xl font-bold text-emerald-400">Multiplayer Lobby</h1>
                    <div className="flex items-center gap-2">
                        <label className="text-gray-400 text-sm">Username:</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-white focus:outline-none focus:border-emerald-500 w-48"
                            placeholder="Enter Username"
                        />
                    </div>
                </div>

                <div className="flex gap-8 h-[500px]">
                    {/* Room List Section */}
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-gray-300">Available Rooms</h2>
                            <button 
                                onClick={() => { setIsCreating(true); setError(null); }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-bold transition-colors"
                            >
                                + Create Room
                            </button>
                        </div>
                        
                        <div className="flex-1 bg-gray-800 rounded border border-gray-700 overflow-y-auto p-2">
                            {rooms.length === 0 ? (
                                <div className="text-gray-500 text-center mt-10">No rooms found. Create one!</div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {rooms.map(room => (
                                        <div 
                                            key={room.id}
                                            onClick={() => { setSelectedRoom(room.id); setError(null); setIsCreating(false); }}
                                            className={`p-3 rounded cursor-pointer flex justify-between items-center transition-colors ${selectedRoom === room.id ? 'bg-emerald-900/50 border border-emerald-500' : 'bg-gray-700/50 hover:bg-gray-700'}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white">{room.name}</span>
                                                <span className="text-xs text-gray-400">ID: {room.id}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm text-gray-300">{room.playerCount} Players</span>
                                                {room.hasPassword && (
                                                    <span className="text-yellow-500 text-xs px-2 py-1 bg-yellow-900/30 rounded border border-yellow-700">LOCKED</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Join Controls (only visible when room selected) */}
                        {selectedRoom && !isCreating && (
                            <div className="bg-gray-800 p-4 rounded border border-gray-700 animate-fade-in">
                                <h3 className="text-lg font-semibold mb-2 text-emerald-400">Join Room</h3>
                                <div className="flex gap-2 items-end">
                                    {rooms.find(r => r.id === selectedRoom)?.hasPassword && (
                                        <div className="flex-1">
                                            <label className="block text-xs text-gray-400 mb-1">Password</label>
                                            <input 
                                                type="password"
                                                value={joinPassword}
                                                onChange={(e) => setJoinPassword(e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                                placeholder="Enter Room Password"
                                            />
                                        </div>
                                    )}
                                    <button 
                                        onClick={handleJoinRoom}
                                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-bold text-white h-[42px]"
                                    >
                                        Join Game
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Create Room Section (Right Side Panel) */}
                    {isCreating && (
                        <div className="w-80 bg-gray-800 p-6 rounded border border-gray-700 flex flex-col gap-4 animate-slide-in-right">
                            <h2 className="text-xl font-bold text-emerald-400 border-b border-gray-700 pb-2">Create New Room</h2>
                            
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Room Name</label>
                                <input 
                                    type="text"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="My Awesome World"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Password (Optional)</label>
                                <input 
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="Leave empty for public"
                                />
                            </div>

                            <div className="flex gap-2 mt-auto pt-4">
                                <button 
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleCreateRoom}
                                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-bold"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Error Message */}
                <div className="flex justify-between items-center border-t border-gray-700 pt-4">
                    <button 
                        onClick={onBack}
                        className="text-gray-400 hover:text-white flex items-center gap-2"
                    >
                        ← Back to Main Menu
                    </button>
                    {error && (
                        <span className="text-red-400 font-medium bg-red-900/20 px-3 py-1 rounded border border-red-900/50">
                            Error: {error}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
