package application;

import game.*;
import gui.Gui;
import gui.IL;

import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Timer;
import java.util.TimerTask;

public class Server {

    //initialize socket and input stream
    private static Socket socket = null;
    private static ServerSocket server = null;
    private static DataInputStream in = null;
    private static DataOutputStream out = null;
    private static Timer t;

    public Server(int port) {

        setup(port);

        receive();

    }

    public static void setup(int port) {
        try {
            server = new ServerSocket(port);
            System.out.println("Server started");

            System.out.println("Waiting for a client ...");

            socket = server.accept();
            System.out.println("Client connected");
            out = new DataOutputStream(socket.getOutputStream());
            Main.connected = true;
            Main.waiting = false;
            Gui.ipInput.setEnabled(false);
            Gui.portInput.setEnabled(false);
            if(Board.serverWhite){
                send("Weiss");
            }else{
                send("Schwarz");
            }
            Gui.changeColor.setVisible(false);
        } catch (IOException e) {
            System.out.println("Connection failed");
        }
    }

    public static void receive() {

        try {
            in = new DataInputStream(new BufferedInputStream(socket.getInputStream()));

        } catch (IOException e) {
            e.printStackTrace();
        }


        t = new Timer();
        t.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                try {

                    String s = in.readUTF();

                    if(s.equals("Laeufer")){
                        if(Board.serverWhite){
                            Board.umwandelnB = new Laeufer(false, IL.figurenB[2]);
                        }else{
                            Board.umwandelnW = new Laeufer(true, IL.figurenW[2]);
                        }
                    }else if(s.equals("Turm")){
                        if(Board.serverWhite){
                            Board.umwandelnB = new Turm(false, IL.figurenB[4]);
                        }else{
                            Board.umwandelnW = new Turm(true, IL.figurenW[4]);
                        }
                    }else if(s.equals("Springer")){
                        if(Board.serverWhite){
                            Board.umwandelnB = new Springer(false, IL.figurenB[3]);
                        }else{
                            Board.umwandelnW = new Springer(true, IL.figurenW[3]);
                        }
                    }else if(s.equals("Dame")){
                        if(Board.serverWhite){
                            Board.umwandelnB = new Dame(false, IL.figurenB[1]);
                        }else{
                            Board.umwandelnW = new Dame(true, IL.figurenW[1]);
                        }
                    }else{
                        Board.moveFromTo(s);
                    }


                } catch (IOException e) {
                    System.out.println("Connection was closed");
                    close();
                }
            }
        }, 200, 200);

    }

    public static void send(String s) {
        try {
            out.writeUTF(s);
        } catch (IOException e) {
            System.out.println("Connection was closed");
            close();
        }
    }

    public static void close() {
        System.out.println("Closing connection");

        t.cancel();
        // close connection
        try {
            out.close();
            socket.close();
            in.close();

        } catch (IOException e) {
            System.out.println("Error occured while closing connections");
        }
    }


}
